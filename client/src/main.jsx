import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import "./styles.css";

const CATS = [
  "All",
  "Fiction",
  "Self Help",
  "Mystery",
  "Finance",
  "Coding",
  "Romance",
  "Students",
  "Hindi",
  "Kids"
];

const money = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN");

async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase products error:", error);
    throw error;
  }

  return (data || []).map((p) => ({
    ...p,
    codPrice: Number(p.cod_price),
    price: Number(p.price),
    mrp: Number(p.mrp),
    stock: Number(p.stock),
    image: p.image_url
  }));
}

async function getProduct(id) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .single();

  if (error) {
    console.error("Supabase product error:", error);
    throw error;
  }

  return {
    ...data,
    codPrice: Number(data.cod_price),
    price: Number(data.price),
    mrp: Number(data.mrp),
    stock: Number(data.stock),
    image: data.image_url
  };
}

function Cover({ p, large = false }) {
  return (
    <div className={"cover " + (large ? "large" : "")}>
      <small>BOOKMANDI</small>

      <div className="coverEmoji">
        {p?.image || "📚"}
      </div>

      <strong>{p?.title || "Book"}</strong>

      <i>{p?.author || ""}</i>
    </div>
  );
}

function Header({ count, q, setQ }) {
  const nav = useNavigate();

  return (
    <header>
      <div className="nav">

        <button
          className="logo"
          onClick={() => nav("/")}
        >
          B <span>BookMandi</span>
        </button>

        <div className="search">
          ⌕
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search books, authors..."
          />
        </div>

        <button
          className="bag"
          onClick={() => nav("/cart")}
        >
          Bag <b>{count}</b>
        </button>

      </div>
    </header>
  );
}

function Store() {
  const nav = useNavigate();

  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("bm_cart") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const data = await getProducts();

        setProducts(data);
      } catch (err) {
        console.error(err);
        setError(
          "Books load nahi ho paayi. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "bm_cart",
      JSON.stringify(cart)
    );
  }, [cart]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const categoryMatch =
        cat === "All" || p.genre === cat;

      const searchText =
        `${p.title} ${p.author} ${p.genre}`.toLowerCase();

      const searchMatch =
        !q ||
        searchText.includes(q.toLowerCase());

      return categoryMatch && searchMatch;
    });
  }, [products, q, cat]);

  const add = (p) => {
    setCart((current) => {
      const exists = current.some(
        (x) => x.id === p.id
      );

      if (exists) {
        return current.map((x) =>
          x.id === p.id
            ? { ...x, qty: x.qty + 1 }
            : x
        );
      }

      return [
        ...current,
        {
          ...p,
          qty: 1
        }
      ];
    });
  };

  const count = cart.reduce(
    (a, x) => a + x.qty,
    0
  );

  return (
    <>
      <Header
        count={count}
        q={q}
        setQ={setQ}
      />

      <main>

        <section className="hero">

          <div>

            <label>
              THE INTERNET'S LITTLE BOOK MANDI
            </label>

            <h1>
              Books you want.
              <br />
              <em>Prices you won't expect.</em>
            </h1>

            <p>
              Good books, low prices, zero delivery
              drama. Online payment gets the lower
              price. COD is available too.
            </p>

            <button
              className="primary"
              onClick={() =>
                document
                  .getElementById("shop")
                  ?.scrollIntoView({
                    behavior: "smooth"
                  })
              }
            >
              Browse the mandi ↓
            </button>

          </div>

          <div className="heroVisual">

            {products
              .slice(0, 3)
              .map((p, i) => (
                <div
                  className={"heroBook h" + i}
                  key={p.id}
                >
                  <Cover p={p} />
                </div>
              ))}

          </div>

        </section>

        <div className="trust">

          <span>
            <b>FREE DELIVERY</b>
            Every order
          </span>

          <span>
            <b>PAY YOUR WAY</b>
            UPI · Cards · COD
          </span>

          <span>
            <b>LOW PRICES</b>
            Clear pricing
          </span>

        </div>

        <section
          id="shop"
          className="shop"
        >

          <label>TODAY'S SHELVES</label>

          <div className="sectionTitle">

            <h2>
              Find your next read.
            </h2>

            <span>
              {filtered.length} books
            </span>

          </div>

          <div className="chips">

            {CATS.map((c) => (
              <button
                key={c}
                className={
                  cat === c ? "on" : ""
                }
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}

          </div>

          {loading ? (

            <div className="loading">
              Loading books...
            </div>

          ) : error ? (

            <div className="empty">
              <b>⚠️</b>
              <h3>Books load nahi hui.</h3>
              <p>{error}</p>
            </div>

          ) : filtered.length ? (

            <div className="grid">

              {filtered.map((p) => {

                const discount =
                  p.mrp > 0
                    ? Math.max(
                        0,
                        Math.round(
                          (1 - p.price / p.mrp) * 100
                        )
                      )
                    : 0;

                return (
                  <article
                    className="product"
                    key={p.id}
                  >

                    <button
                      className="coverBtn"
                      onClick={() =>
                        nav("/product/" + p.id)
                      }
                    >
                      <Cover p={p} />
                    </button>

                    <label>
                      {p.genre}
                    </label>

                    <h3>
                      {p.title}
                    </h3>

                    <small>
                      {p.author}
                    </small>

                    <div className="price">

                      <b>
                        {money(p.price)}
                      </b>

                      <del>
                        {money(p.mrp)}
                      </del>

                      <i>
                        {discount}% OFF
                      </i>

                    </div>

                    <p>
                      Online {money(p.price)}
                      {" · "}
                      COD {money(p.codPrice)}
                    </p>

                    <button
                      className="add"
                      onClick={() => add(p)}
                      disabled={!p.stock}
                    >
                      {p.stock
                        ? "Add to bag"
                        : "Out of stock"}
                    </button>

                  </article>
                );
              })}

            </div>

          ) : (

            <div className="empty">

              <b>📚</b>

              <h3>
                Nothing on this shelf.
              </h3>

              <p>
                Try another search or category.
              </p>

            </div>

          )}

        </section>

        <section className="why">

          <div>

            <label>
              WAIT, WHY SO CHEAP?
            </label>

            <h2>
              A good book shouldn't need
              a rich-person budget.
            </h2>

          </div>

          <div>
            <b>01</b>
            <h3>Clear prices</h3>
            <p>
              Online and COD prices are
              shown before you buy.
            </p>
          </div>

          <div>
            <b>02</b>
            <h3>Free delivery</h3>
            <p>
              No surprise shipping line
              at checkout.
            </p>
          </div>

          <div>
            <b>03</b>
            <h3>Pay your way</h3>
            <p>
              Online for the lower price,
              COD when you prefer.
            </p>
          </div>

        </section>

      </main>

      <footer>
        BookMandi · Books. Kam Daam. No Drama.

        <button
          onClick={() => nav("/admin")}
        >
          Admin
        </button>
      </footer>
    </>
  );
}

function ProductPage() {
  const { pathname } = useLocation();

  const id = pathname
    .split("/")
    .pop();

  const nav = useNavigate();

  const [p, setP] = useState(null);
  const [loading, setLoading] =
    useState(true);

  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("bm_cart") || "[]"
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const product =
          await getProduct(id);

        setP(product);

      } catch (error) {
        console.error(error);
        setP(null);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      load();
    }
  }, [id]);

  useEffect(() => {
    localStorage.setItem(
      "bm_cart",
      JSON.stringify(cart)
    );
  }, [cart]);

  if (loading) {
    return (
      <div className="loading">
        Loading book...
      </div>
    );
  }

  if (!p) {
    return (
      <div className="loading">
        <h3>Book not found.</h3>

        <button
          className="primary"
          onClick={() => nav("/")}
        >
          Back to BookMandi
        </button>
      </div>
    );
  }

  const add = () => {
    setCart((current) => {
      const exists = current.some(
        (x) => x.id === p.id
      );

      if (exists) {
        return current.map((x) =>
          x.id === p.id
            ? {
                ...x,
                qty: x.qty + 1
              }
            : x
        );
      }

      return [
        ...current,
        {
          ...p,
          qty: 1
        }
      ];
    });

    nav("/cart");
  };

  const cartCount = cart.reduce(
    (a, x) => a + x.qty,
    0
  );

  return (
    <>
      <div className="simpleTop">

        <button
          onClick={() => nav("/")}
        >
          ← BookMandi
        </button>

        <button
          onClick={() => nav("/cart")}
        >
          Bag ({cartCount})
        </button>

      </div>

      <main className="productPage">

        <Cover
          p={p}
          large
        />

        <div className="productCopy">

          <label>
            {p.genre}
          </label>

          <h1>
            {p.title}
          </h1>

          <p className="author">
            {p.author}
          </p>

          <p>
            {p.description}
          </p>

          <div className="priceBig">

            {money(p.price)}

            <del>
              {money(p.mrp)}
            </del>

          </div>

          <div className="payOptions">

            <div>

              <b>ONLINE</b>

              <strong>
                {money(p.price)}
              </strong>

              <small>
                Lower price
              </small>

            </div>

            <div>

              <b>COD</b>

              <strong>
                {money(p.codPrice)}
              </strong>

              <small>
                Cash on delivery
              </small>

            </div>

          </div>

          <p className="green">
            ✓ Free delivery
          </p>

          <p className="stock">
            {p.stock > 0
              ? `${p.stock} in stock`
              : "Currently out of stock"}
          </p>

          <button
            className="primary full"
            disabled={!p.stock}
            onClick={add}
          >
            {p.stock
              ? "Add to bag"
              : "Out of stock"}
          </button>

        </div>

      </main>
    </>
  );
}

function Cart() {
  const nav = useNavigate();

  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("bm_cart") || "[]"
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(
      "bm_cart",
      JSON.stringify(cart)
    );
  }, [cart]);

  const count = cart.reduce(
    (a, x) => a + x.qty,
    0
  );

  const total = cart.reduce(
    (a, x) =>
      a +
      x.qty *
        Number(x.price || 0),
    0
  );

  const change = (id, d) => {
    setCart((current) =>
      current.flatMap((x) => {
        if (x.id !== id) {
          return [x];
        }

        const newQty =
          x.qty + d;

        if (newQty <= 0) {
          return [];
        }

        return [
          {
            ...x,
            qty: newQty
          }
        ];
      })
    );
  };

  return (
    <div className="page">

      <div className="simpleTop">

        <button
          onClick={() => nav("/")}
        >
          ← Continue shopping
        </button>

      </div>

      <div className="cartPage">

        <div>

          <label>
            YOUR BAG
          </label>

          <h1>
            {count} item
            {count !== 1 ? "s" : ""}
          </h1>

          {cart.length ? (

            cart.map((x) => (
              <div
                className="cartRow"
                key={x.id}
              >

                <Cover p={x} />

                <div>

                  <h3>
                    {x.title}
                  </h3>

                  <small>
                    {x.author}
                  </small>

                  <p>
                    {money(x.price)}
                    {" online · "}
                    {money(x.codPrice)}
                    {" COD"}
                  </p>

                  <div className="qty">

                    <button
                      onClick={() =>
                        change(x.id, -1)
                      }
                    >
                      −
                    </button>

                    <b>
                      {x.qty}
                    </b>

                    <button
                      onClick={() =>
                        change(x.id, 1)
                      }
                    >
                      +
                    </button>

                  </div>

                </div>

              </div>
            ))

          ) : (

            <div className="empty">

              <b>🛍️</b>

              <h3>
                Your bag is empty.
              </h3>

            </div>

          )}

        </div>

        {cart.length > 0 && (

          <aside className="summary">

            <label>
              ORDER SUMMARY
            </label>

            {cart.map((x) => (
              <p key={x.id}>

                {x.title} × {x.qty}

                <b>
                  {money(
                    x.price * x.qty
                  )}
                </b>

              </p>
            ))}

            <hr />

            <div className="total">

              <span>
                Online total
              </span>

              <strong>
                {money(total)}
              </strong>

            </div>

            <small className="green">
              ✓ Free delivery
            </small>

            <button
              className="primary full"
              onClick={() =>
                nav("/checkout")
              }
            >
              Checkout
            </button>

          </aside>

        )}

      </div>

    </div>
  );
}

function Checkout() {
  const nav = useNavigate();

  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("bm_cart") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [method, setMethod] =
    useState("ONLINE");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    pincode: ""
  });

  const [msg, setMsg] =
    useState("");

  const total = cart.reduce(
    (a, x) =>
      a +
      x.qty *
        (method === "COD"
          ? x.codPrice
          : x.price),
    0
  );

  const field = (key, placeholder) => (
    <input
      required
      placeholder={placeholder}
      value={form[key]}
      onChange={(e) =>
        setForm({
          ...form,
          [key]: e.target.value
        })
      }
    />
  );

  async function submit(e) {
    e.preventDefault();

    /*
      Checkout backend is intentionally not connected yet.

      We are migrating BookMandi to:

      React
        ↓
      Supabase
        ↓
      Cashfree

      COD order creation and Cashfree payment
      will be connected after the database/product
      layer is confirmed working.
    */

    setMsg(
      "Checkout backend is being connected to Supabase + Cashfree."
    );
  }

  return (
    <div className="page">

      <div className="simpleTop">

        <button
          onClick={() => nav("/cart")}
        >
          ← Bag
        </button>

      </div>

      <main className="checkout">

        <label>
          SECURE CHECKOUT
        </label>

        <h1>
          Almost there.
        </h1>

        {msg && (
          <div className="notice">
            {msg}
          </div>
        )}

        <div className="checkoutGrid">

          <form onSubmit={submit}>

            {field(
              "name",
              "Full name"
            )}

            {field(
              "phone",
              "Phone number"
            )}

            {field(
              "address",
              "Full delivery address"
            )}

            <div className="two">

              {field(
                "city",
                "City"
              )}

              {field(
                "pincode",
                "Pincode"
              )}

            </div>

            <div className="methods">

              <button
                type="button"
                className={
                  method === "ONLINE"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setMethod("ONLINE")
                }
              >

                <b>ONLINE</b>

                <strong>
                  {money(
                    cart.reduce(
                      (a, x) =>
                        a +
                        x.qty *
                          x.price,
                      0
                    )
                  )}
                </strong>

                <small>
                  UPI · Cards · Netbanking
                </small>

              </button>

              <button
                type="button"
                className={
                  method === "COD"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setMethod("COD")
                }
              >

                <b>COD</b>

                <strong>
                  {money(
                    cart.reduce(
                      (a, x) =>
                        a +
                        x.qty *
                          x.codPrice,
                      0
                    )
                  )}
                </strong>

                <small>
                  Cash on delivery
                </small>

              </button>

            </div>

            <button
              className="primary full"
              type="submit"
            >
              Place order · {money(total)}
            </button>

          </form>

          <aside className="summary">

            <label>
              YOUR TOTAL
            </label>

            <h2>
              {money(total)}
            </h2>

            <p>
              Payment:
              {" "}
              <b>
                {method === "COD"
                  ? "Cash on Delivery"
                  : "Online"}
              </b>
            </p>

            <p className="green">
              ✓ Free delivery
            </p>

          </aside>

        </div>

      </main>

    </div>
  );
}

function Admin() {
  const nav = useNavigate();

  const [session, setSession] =
    useState(null);

  const [products, setProducts] =
    useState([]);

  const [orders, setOrders] =
    useState([]);

  const [tab, setTab] =
    useState("products");

  const [msg, setMsg] =
    useState("");

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      setSession(session);
    }

    loadSession();

    const {
      data: listener
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    async function loadAdminData() {
      const {
        data: productData,
        error: productError
      } = await supabase
        .from("products")
        .select("*")
        .order("created_at", {
          ascending: false
        });

      if (productError) {
        console.error(
          "Admin products error:",
          productError
        );
      } else {
        setProducts(
          (productData || []).map((p) => ({
            ...p,
            codPrice: Number(
              p.cod_price
            ),
            price: Number(p.price),
            mrp: Number(p.mrp),
            stock: Number(p.stock),
            image: p.image_url
          }))
        );
      }

      const {
        data: orderData,
        error: orderError
      } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", {
          ascending: false
        });

      if (orderError) {
        console.error(
          "Admin orders error:",
          orderError
        );
      } else {
        setOrders(orderData || []);
      }
    }

    loadAdminData();
  }, [session]);

  async function signIn(e) {
    e.preventDefault();

    const form =
      new FormData(e.currentTarget);

    const email =
      form.get("email");

    const password =
      form.get("password");

    setMsg("");

    const {
      error
    } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMsg(error.message);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  async function save(p) {
    setMsg("");

    const {
      error
    } = await supabase
      .from("products")
      .update({
        price: Number(p.price),
        cod_price: Number(
          p.codPrice
        ),
        stock: Number(p.stock)
      })
      .eq("id", p.id);

    if (error) {
      console.error(error);
      setMsg(error.message);
      return;
    }

    setMsg("Saved ✓");
  }

  if (!session) {
    return (
      <div className="admin login">

        <label>
          BOOKMANDI CONTROL ROOM
        </label>

        <h1>
          Admin login
        </h1>

        <form onSubmit={signIn}>

          <input
            name="email"
            type="email"
            required
            placeholder="Email"
          />

          <input
            name="password"
            type="password"
            required
            placeholder="Password"
          />

          <button
            className="primary full"
            type="submit"
          >
            Enter dashboard
          </button>

        </form>

        {msg && (
          <p>{msg}</p>
        )}

      </div>
    );
  }

  return (
    <div className="admin">

      <div className="adminTop">

        <button
          onClick={() => nav("/")}
        >
          ← Store
        </button>

        <button
          onClick={logout}
        >
          Log out
        </button>

      </div>

      <label>
        CONTROL ROOM
      </label>

      <h1>
        BookMandi Admin
      </h1>

      <div className="stats">

        <div>
          <b>
            {products.length}
          </b>
          Products
        </div>

        <div>
          <b>
            {orders.length}
          </b>
          Orders
        </div>

        <div>
          <b>
            {money(
              orders.reduce(
                (a, o) =>
                  a +
                  Number(
                    o.total || 0
                  ),
                0
              )
            )}
          </b>
          Order value
        </div>

      </div>

      <div className="tabs">

        <button
          className={
            tab === "products"
              ? "on"
              : ""
          }
          onClick={() =>
            setTab("products")
          }
        >
          Products
        </button>

        <button
          className={
            tab === "orders"
              ? "on"
              : ""
          }
          onClick={() =>
            setTab("orders")
          }
        >
          Orders
        </button>

      </div>

      {tab === "products" ? (

        <>

          <div className="adminHead">

            <h2>
              Products
            </h2>

            <span>
              {msg}
            </span>

          </div>

          <div className="adminTable">

            {products.map((p) => (

              <div
                className="adminRow"
                key={p.id}
              >

                <div>

                  <b>
                    {p.title}
                  </b>

                  <small>
                    {p.author}
                  </small>

                </div>

                <label>

                  Online

                  <input
                    type="number"
                    value={p.price}
                    onChange={(e) =>
                      setProducts(
                        products.map(
                          (x) =>
                            x.id === p.id
                              ? {
                                  ...x,
                                  price:
                                    Number(
                                      e.target
                                        .value
                                    )
                                }
                              : x
                        )
                      )
                    }
                  />

                </label>

                <label>

                  COD

                  <input
                    type="number"
                    value={
                      p.codPrice
                    }
                    onChange={(e) =>
                      setProducts(
                        products.map(
                          (x) =>
                            x.id === p.id
                              ? {
                                  ...x,
                                  codPrice:
                                    Number(
                                      e.target
                                        .value
                                    )
                                }
                              : x
                        )
                      )
                    }
                  />

                </label>

                <label>

                  Stock

                  <input
                    type="number"
                    value={
                      p.stock
                    }
                    onChange={(e) =>
                      setProducts(
                        products.map(
                          (x) =>
                            x.id === p.id
                              ? {
                                  ...x,
                                  stock:
                                    Number(
                                      e.target
                                        .value
                                    )
                                }
                              : x
                        )
                      )
                    }
                  />

                </label>

                <button
                  onClick={() =>
                    save(p)
                  }
                >
                  Save
                </button>

              </div>

            ))}

          </div>

        </>

      ) : (

        <div>

          {orders.length ? (

            orders.map((o) => (

              <div
                className="order"
                key={o.id}
              >

                <b>
                  {o.id}
                </b>

                <span>
                  {o.customer_name}
                </span>

                <span>
                  {o.payment_method}
                </span>

                <span>
                  {money(o.total)}
                </span>

                <strong>
                  {o.status}
                </strong>

              </div>

            ))

          ) : (

            <div className="empty">
              No orders yet.
            </div>

          )}

        </div>

      )}

    </div>
  );
}

function App() {
  const path =
    useLocation().pathname;

  if (path === "/cart") {
    return <Cart />;
  }

  if (path === "/checkout") {
    return <Checkout />;
  }

  if (path.startsWith("/product/")) {
    return <ProductPage />;
  }

  if (path === "/admin") {
    return <Admin />;
  }

  return <Store />;
}

createRoot(
  document.getElementById("root")
).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);