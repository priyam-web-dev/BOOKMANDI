import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA = path.join(__dirname, "data.json");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const SECRET = process.env.JWT_SECRET || "dev-only-change-me";

const allowedStatuses = [
  "PAYMENT_PENDING",
  "PAID",
  "COD_PENDING",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED"
];

const transitions = {
  PAYMENT_PENDING: ["PAID", "CANCELLED"],
  COD_PENDING: ["CONFIRMED", "CANCELLED"],
  PAID: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: []
};

/*
|--------------------------------------------------------------------------
| SECURITY
|--------------------------------------------------------------------------
*/

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

/*
|--------------------------------------------------------------------------
| RAZORPAY WEBHOOK
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Razorpay signature verification requires the ORIGINAL raw request body.
| Therefore this route MUST come before express.json().
|
*/

app.post(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
    limit: "256kb"
  }),
  (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      return res.sendStatus(200);
    }

    const signature = String(
      req.headers["x-razorpay-signature"] || ""
    );

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from("");

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (
      !signature ||
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(
        Buffer.from(expected, "utf8"),
        Buffer.from(signature, "utf8")
      )
    ) {
      return res.sendStatus(400);
    }

    let event;

    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.sendStatus(400);
    }

    const payment = event?.payload?.payment?.entity;

    const paymentId = payment?.id;
    const razorpayOrderId = payment?.order_id;

    if (
      event?.event === "payment.captured" &&
      paymentId &&
      razorpayOrderId
    ) {
      const data = read();

      const order = (data.orders || []).find(
        (item) => item.razorpayOrderId === razorpayOrderId
      );

      if (order && order.status !== "PAID") {
        const stockReserved = reserveStock(
          data,
          order.items
        );

        if (stockReserved) {
          order.status = "PAID";
          order.razorpayPaymentId = paymentId;
          order.paidAt =
            order.paidAt || new Date().toISOString();
          order.updatedAt = new Date().toISOString();

          write(data);
        }
      }
    }

    return res.sendStatus(200);
  }
);

/*
|--------------------------------------------------------------------------
| JSON BODY
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit: "100kb"
  })
);

/*
|--------------------------------------------------------------------------
| API RATE LIMIT
|--------------------------------------------------------------------------
*/

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api", apiLimiter);

/*
|--------------------------------------------------------------------------
| DATA HELPERS
|--------------------------------------------------------------------------
*/

function read() {
  const data = JSON.parse(
    fs.readFileSync(DATA, "utf8")
  );

  data.products ||= [];
  data.orders ||= [];

  return data;
}

function write(data) {
  const tempFile = `${DATA}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(data, null, 2)
  );

  fs.renameSync(tempFile, DATA);
}

function clean(value, max = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function createOrderId() {
  return (
    `BM-${Date.now().toString(36).toUpperCase()}-` +
    crypto.randomBytes(3).toString("hex").toUpperCase()
  );
}

/*
|--------------------------------------------------------------------------
| ADMIN AUTH
|--------------------------------------------------------------------------
*/

function adminAuth(req, res, next) {
  try {
    const header =
      req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      throw new Error("Missing token");
    }

    const token = header.slice(7);

    req.admin = jwt.verify(
      token,
      SECRET
    );

    next();
  } catch {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }
}

/*
|--------------------------------------------------------------------------
| PRODUCT HELPERS
|--------------------------------------------------------------------------
*/

function getProduct(data, productId) {
  return data.products.find(
    (product) =>
      product.id === productId &&
      product.active !== false
  );
}

/*
|--------------------------------------------------------------------------
| ORDER / INVENTORY HELPERS
|--------------------------------------------------------------------------
*/

function buildOrderLines(
  items,
  payment,
  data
) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error("Your cart is empty");
  }

  const lines = [];
  let total = 0;

  for (const item of items) {
    const product = getProduct(
      data,
      item.productId
    );

    if (!product) {
      throw new Error(
        "A selected book is unavailable"
      );
    }

    const qty = Math.min(
      20,
      Math.max(
        1,
        Math.floor(
          Number(item.qty) || 1
        )
      )
    );

    if (
      !Number.isInteger(product.stock) ||
      product.stock < qty
    ) {
      throw new Error(
        `${product.title} does not have enough stock`
      );
    }

    const unitPrice =
      payment === "COD"
        ? Number(product.codPrice)
        : Number(product.price);

    if (
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0
    ) {
      throw new Error(
        `Invalid price for ${product.title}`
      );
    }

    total += unitPrice * qty;

    lines.push({
      productId: product.id,
      title: product.title,
      qty,
      unitPrice
    });
  }

  return {
    total,
    lines
  };
}

function reserveStock(
  data,
  lines
) {
  /*
   * First validate EVERYTHING.
   * Only after that do we modify stock.
   */

  for (const line of lines) {
    const product =
      data.products.find(
        (item) =>
          item.id === line.productId
      );

    if (
      !product ||
      product.active === false ||
      product.stock < line.qty
    ) {
      return false;
    }
  }

  for (const line of lines) {
    const product =
      data.products.find(
        (item) =>
          item.id === line.productId
      );

    product.stock -= line.qty;
  }

  return true;
}

function restoreStock(
  data,
  lines
) {
  for (const line of lines || []) {
    const product =
      data.products.find(
        (item) =>
          item.id === line.productId
      );

    if (product) {
      product.stock +=
        Number(line.qty) || 0;
    }
  }
}

/*
|--------------------------------------------------------------------------
| HEALTH
|--------------------------------------------------------------------------
*/

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "BookMandi",
      time: new Date().toISOString()
    });
  }
);

/*
|--------------------------------------------------------------------------
| PUBLIC PRODUCTS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/products",
  (req, res) => {
    const data = read();

    const q = clean(
      req.query.q,
      100
    ).toLowerCase();

    const genre = clean(
      req.query.genre,
      50
    );

    let products =
      data.products.filter(
        (product) =>
          product.active !== false
      );

    if (q) {
      products =
        products.filter(
          (product) =>
            `${product.title} ${product.author} ${product.genre}`
              .toLowerCase()
              .includes(q)
        );
    }

    if (
      genre &&
      genre !== "All"
    ) {
      products =
        products.filter(
          (product) =>
            product.genre === genre
        );
    }

    res.json(products);
  }
);

/*
|--------------------------------------------------------------------------
| SINGLE PRODUCT
|--------------------------------------------------------------------------
*/

app.get(
  "/api/products/:id",
  (req, res) => {
    const data = read();

    const product =
      getProduct(
        data,
        req.params.id
      );

    if (!product) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    res.json(product);
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN LOGIN
|--------------------------------------------------------------------------
*/

app.post(
  "/api/admin/login",
  (req, res) => {
    const email = clean(
      req.body.email,
      200
    );

    const password =
      String(
        req.body.password || ""
      );

    if (
      !process.env.ADMIN_EMAIL ||
      !process.env.ADMIN_PASSWORD ||
      email !==
        process.env.ADMIN_EMAIL ||
      password !==
        process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({
        error:
          "Invalid email or password"
      });
    }

    const token =
      jwt.sign(
        {
          role: "admin",
          email
        },
        SECRET,
        {
          expiresIn: "8h"
        }
      );

    res.json({
      token
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN PRODUCTS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/admin/products",
  adminAuth,
  (req, res) => {
    res.json(
      read().products
    );
  }
);

app.post(
  "/api/admin/products",
  adminAuth,
  (req, res) => {
    const b = req.body;

    const product = {
      id:
        `bm_${crypto.randomBytes(7).toString("hex")}`,

      title: clean(
        b.title,
        150
      ),

      author: clean(
        b.author,
        150
      ),

      genre:
        clean(
          b.genre,
          50
        ) || "Other",

      price:
        Number(b.price),

      codPrice:
        Number(b.codPrice),

      mrp:
        Number(b.mrp),

      stock:
        Math.max(
          0,
          Math.floor(
            Number(b.stock) || 0
          )
        ),

      image:
        clean(
          b.image,
          500
        ) || "📚",

      description:
        clean(
          b.description,
          2000
        ),

      active:
        b.active !== false,

      createdAt:
        new Date().toISOString()
    };

    if (
      !product.title ||
      !product.author ||
      [
        product.price,
        product.codPrice,
        product.mrp
      ].some(
        (number) =>
          !Number.isFinite(number) ||
          number <= 0
      ) ||
      product.price >
        product.mrp ||
      product.codPrice <
        product.price
    ) {
      return res.status(400).json({
        error:
          "Check product and pricing data"
      });
    }

    const data = read();

    data.products.push(
      product
    );

    write(data);

    res.status(201).json(
      product
    );
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE PRODUCT
|--------------------------------------------------------------------------
*/

app.put(
  "/api/admin/products/:id",
  adminAuth,
  (req, res) => {
    const data = read();

    const index =
      data.products.findIndex(
        (product) =>
          product.id ===
          req.params.id
      );

    if (index < 0) {
      return res.status(404).json({
        error:
          "Product not found"
      });
    }

    const old =
      data.products[index];

    const b = req.body;

    const product = {
      ...old,

      title: clean(
        b.title,
        150
      ),

      author: clean(
        b.author,
        150
      ),

      genre:
        clean(
          b.genre,
          50
        ) || "Other",

      price:
        Number(b.price),

      codPrice:
        Number(b.codPrice),

      mrp:
        Number(b.mrp),

      stock:
        Math.max(
          0,
          Math.floor(
            Number(b.stock) || 0
          )
        ),

      image:
        clean(
          b.image,
          500
        ),

      description:
        clean(
          b.description,
          2000
        ),

      active:
        b.active !== false
    };

    if (
      !product.title ||
      !product.author ||
      [
        product.price,
        product.codPrice,
        product.mrp
      ].some(
        (number) =>
          !Number.isFinite(number) ||
          number <= 0
      ) ||
      product.price >
        product.mrp ||
      product.codPrice <
        product.price
    ) {
      return res.status(400).json({
        error:
          "Invalid product data"
      });
    }

    data.products[index] =
      product;

    write(data);

    res.json(product);
  }
);

/*
|--------------------------------------------------------------------------
| SOFT DELETE PRODUCT
|--------------------------------------------------------------------------
*/

app.delete(
  "/api/admin/products/:id",
  adminAuth,
  (req, res) => {
    const data = read();

    const product =
      data.products.find(
        (item) =>
          item.id ===
          req.params.id
      );

    if (!product) {
      return res.status(404).json({
        error:
          "Product not found"
      });
    }

    product.active = false;

    write(data);

    res.sendStatus(204);
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN ORDERS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/admin/orders",
  adminAuth,
  (req, res) => {
    const data = read();

    const status =
      clean(
        req.query.status,
        40
      );

    let orders =
      data.orders;

    if (status) {
      orders =
        orders.filter(
          (order) =>
            order.status ===
            status
        );
    }

    orders =
      [...orders].sort(
        (a, b) =>
          new Date(
            b.createdAt
          ) -
          new Date(
            a.createdAt
          )
      );

    res.json(orders);
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN ANALYTICS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/admin/analytics",
  adminAuth,
  (req, res) => {
    const data = read();

    const orders =
      data.orders || [];

    const revenueStatuses =
      new Set([
        "PAID",
        "CONFIRMED",
        "PACKED",
        "SHIPPED",
        "DELIVERED"
      ]);

    const revenue =
      orders
        .filter(
          (order) =>
            revenueStatuses.has(
              order.status
            )
        )
        .reduce(
          (sum, order) =>
            sum +
            Number(
              order.total || 0
            ),
          0
        );

    const unitsSold =
      orders
        .filter(
          (order) =>
            revenueStatuses.has(
              order.status
            )
        )
        .reduce(
          (sum, order) =>
            sum +
            (order.items || [])
              .reduce(
                (
                  inner,
                  item
                ) =>
                  inner +
                  Number(
                    item.qty || 0
                  ),
                0
              ),
          0
        );

    res.json({
      products:
        data.products.length,

      activeProducts:
        data.products.filter(
          (product) =>
            product.active !== false
        ).length,

      orders:
        orders.length,

      revenue,

      unitsSold,

      codOrders:
        orders.filter(
          (order) =>
            order.paymentMethod ===
            "COD"
        ).length,

      onlineOrders:
        orders.filter(
          (order) =>
            order.paymentMethod ===
            "ONLINE"
        ).length,

      pending:
        orders.filter(
          (order) =>
            [
              "PAYMENT_PENDING",
              "COD_PENDING"
            ].includes(
              order.status
            )
        ).length,

      lowStock:
        data.products.filter(
          (product) =>
            product.active !== false &&
            Number(product.stock) <= 3
        ).length
    });
  }
);

/*
|--------------------------------------------------------------------------
| ORDER STATUS
|--------------------------------------------------------------------------
*/

app.patch(
  "/api/admin/orders/:id/status",
  adminAuth,
  (req, res) => {
    const data = read();

    const order =
      data.orders.find(
        (item) =>
          item.id ===
          req.params.id
      );

    const nextStatus =
      clean(
        req.body.status,
        40
      );

    if (!order) {
      return res.status(404).json({
        error:
          "Order not found"
      });
    }

    if (
      !allowedStatuses.includes(
        nextStatus
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid status"
      });
    }

    if (
      nextStatus ===
      order.status
    ) {
      return res.json(order);
    }

    if (
      !transitions[
        order.status
      ]?.includes(
        nextStatus
      )
    ) {
      return res.status(409).json({
        error:
          `Cannot move order from ${order.status} to ${nextStatus}`
      });
    }

    /*
     * If an already-paid/confirmed order
     * is cancelled, return its stock.
     *
     * stockRestoredAt prevents
     * double restoration.
     */

    if (
      nextStatus ===
        "CANCELLED" &&
      [
        "PAID",
        "CONFIRMED",
        "PACKED",
        "SHIPPED"
      ].includes(
        order.status
      ) &&
      !order.stockRestoredAt
    ) {
      restoreStock(
        data,
        order.items
      );

      order.stockRestoredAt =
        new Date().toISOString();
    }

    order.status =
      nextStatus;

    order.updatedAt =
      new Date().toISOString();

    write(data);

    res.json(order);
  }
);

/*
|--------------------------------------------------------------------------
| CREATE ORDER
|--------------------------------------------------------------------------
*/

app.post(
  "/api/orders",
  async (req, res) => {
    try {
      const data = read();

      const payment =
        req.body.paymentMethod ===
        "COD"
          ? "COD"
          : "ONLINE";

      const customer =
        req.body.customer || {};

      const c = {
        name: clean(
          customer.name,
          100
        ),

        phone: clean(
          customer.phone,
          30
        ),

        address: clean(
          customer.address,
          500
        ),

        city: clean(
          customer.city,
          80
        ),

        pincode: clean(
          customer.pincode,
          10
        )
      };

      if (
        !c.name ||
        !c.phone ||
        !c.address ||
        !c.city ||
        !c.pincode
      ) {
        return res.status(400).json({
          error:
            "Please complete all checkout details"
        });
      }

      const {
        total,
        lines
      } =
        buildOrderLines(
          req.body.items,
          payment,
          data
        );

      const order = {
        id: createOrderId(),

        createdAt:
          new Date().toISOString(),

        customer: c,

        paymentMethod:
          payment,

        items:
          lines,

        total,

        currency:
          "INR",

        status:
          payment === "COD"
            ? "COD_PENDING"
            : "PAYMENT_PENDING"
      };

      /*
       * COD:
       * Reserve stock immediately.
       */

      if (
        payment === "COD"
      ) {
        const stockReserved =
          reserveStock(
            data,
            lines
          );

        if (!stockReserved) {
          return res.status(409).json({
            error:
              "Stock changed. Please refresh your cart."
          });
        }

        data.orders.push(
          order
        );

        write(data);

        return res
          .status(201)
          .json({
            orderId:
              order.id,

            total:
              order.total,

            status:
              order.status
          });
      }

      /*
       * ONLINE PAYMENT
       */

      if (
        !process.env.RAZORPAY_KEY_ID ||
        !process.env.RAZORPAY_KEY_SECRET
      ) {
        return res.status(503).json({
          error:
            "Online payment is not connected yet"
        });
      }

      const razorpay =
        new Razorpay({
          key_id:
            process.env
              .RAZORPAY_KEY_ID,

          key_secret:
            process.env
              .RAZORPAY_KEY_SECRET
        });

      const razorpayOrder =
        await razorpay.orders.create({
          amount:
            Math.round(
              total * 100
            ),

          currency:
            "INR",

          receipt:
            order.id,

          notes: {
            bookmandi_order_id:
              order.id
          }
        });

      order.razorpayOrderId =
        razorpayOrder.id;

      data.orders.push(
        order
      );

      write(data);

      return res
        .status(201)
        .json({
          orderId:
            order.id,

          razorpay: {
            id:
              razorpayOrder.id,

            amount:
              razorpayOrder.amount,

            currency:
              razorpayOrder.currency,

            keyId:
              process.env
                .RAZORPAY_KEY_ID
          }
        });
    } catch (error) {
      console.error(
        "Order creation error:",
        error
      );

      return res.status(400).json({
        error:
          error.message ||
          "Could not create order"
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| VERIFY RAZORPAY PAYMENT
|--------------------------------------------------------------------------
*/

app.post(
  "/api/payments/verify",
  (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        orderId
      } = req.body;

      if (
        !process.env
          .RAZORPAY_KEY_SECRET
      ) {
        return res.status(503).json({
          error:
            "Payment gateway not configured"
        });
      }

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !orderId
      ) {
        return res.status(400).json({
          error:
            "Incomplete payment verification data"
        });
      }

      const expected =
        crypto
          .createHmac(
            "sha256",
            process.env
              .RAZORPAY_KEY_SECRET
          )
          .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
          )
          .digest("hex");

      const signature =
        String(
          razorpay_signature
        );

      if (
        expected.length !==
          signature.length ||
        !crypto.timingSafeEqual(
          Buffer.from(
            expected,
            "utf8"
          ),
          Buffer.from(
            signature,
            "utf8"
          )
        )
      ) {
        return res.status(400).json({
          error:
            "Payment verification failed"
        });
      }

      const data = read();

      const order =
        data.orders.find(
          (item) =>
            item.id ===
              orderId &&
            item.razorpayOrderId ===
              razorpay_order_id
        );

      if (!order) {
        return res.status(404).json({
          error:
            "Order not found"
        });
      }

      /*
       * Idempotency:
       * If Razorpay calls this twice,
       * stock is NOT deducted twice.
       */

      if (
        order.status ===
        "PAID"
      ) {
        return res.json({
          ok: true,
          orderId:
            order.id,
          status:
            order.status
        });
      }

      if (
        order.status !==
        "PAYMENT_PENDING"
      ) {
        return res.status(409).json({
          error:
            `Order is already ${order.status}`
        });
      }

      const stockReserved =
        reserveStock(
          data,
          order.items
        );

      if (!stockReserved) {
        return res.status(409).json({
          error:
            "Stock changed while payment was processing"
        });
      }

      order.status =
        "PAID";

      order.razorpayPaymentId =
        razorpay_payment_id;

      order.paidAt =
        new Date().toISOString();

      order.updatedAt =
        new Date().toISOString();

      write(data);

      return res.json({
        ok: true,
        orderId:
          order.id,
        status:
          order.status
      });
    } catch (error) {
      console.error(
        "Payment verification error:",
        error
      );

      return res.status(400).json({
        error:
          error.message ||
          "Verification failed"
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CUSTOMER ORDER TRACKING
|--------------------------------------------------------------------------
*/

app.post(
  "/api/orders/track",
  (req, res) => {
    const orderId =
      clean(
        req.body.orderId,
        100
      );

    const phone =
      clean(
        req.body.phone,
        30
      );

    if (
      !orderId ||
      !phone
    ) {
      return res.status(400).json({
        error:
          "Order ID and phone number are required"
      });
    }

    const data = read();

    const order =
      data.orders.find(
        (item) =>
          item.id ===
            orderId &&
          item.customer?.phone ===
            phone
      );

    if (!order) {
      return res.status(404).json({
        error:
          "Order not found. Check your Order ID and phone number."
      });
    }

    res.json({
      orderId:
        order.id,

      createdAt:
        order.createdAt,

      status:
        order.status,

      paymentMethod:
        order.paymentMethod,

      total:
        order.total,

      items:
        order.items,

      customer: {
        name:
          order.customer?.name,

        city:
          order.customer?.city,

        pincode:
          order.customer?.pincode
      }
    });
  }
);

/*
|--------------------------------------------------------------------------
| SERVE FRONTEND BUILD
|--------------------------------------------------------------------------
*/

const dist =
  path.join(
    ROOT,
    "client",
    "dist"
  );

if (
  fs.existsSync(dist)
) {
  app.use(
    express.static(dist)
  );

  app.get(
    "*",
    (req, res) => {
      res.sendFile(
        path.join(
          dist,
          "index.html"
        )
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `BookMandi running on http://localhost:${PORT}`
    );
  }
);