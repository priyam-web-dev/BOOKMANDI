import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  useLocation,
  useNavigate
} from "react-router-dom";
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
  "Kids",
  "Other"
];

const money = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN");

function mapProduct(p) {
  return {
    ...p,
    price: Number(p.price || 0),
    codPrice: Number(p.cod_price || 0),
    mrp: Number(p.mrp || 0),
    stock: Number(p.stock || 0),
    image: p.image_url || "",
    gallery: Array.isArray(p.gallery_urls)
      ? p.gallery_urls
      : []
  };
}

/* =========================================================
   SUPABASE PRODUCTS
========================================================= */

async function getProducts(includeInactive = false) {
  let query = supabase
    .from("products")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(mapProduct);
}

async function getProduct(id) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .single();

  if (error) throw error;

  return mapProduct(data);
}

/* =========================================================
   IMAGE UPLOAD
========================================================= */

async function uploadImage(file) {
  if (!file) return null;

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "jpg";

  const safeName =
    file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 50);

  const filePath =
    `books/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}-${safeName}.${extension}`;

  const { error } = await supabase.storage
    .from("book-covers")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  const {
    data: { publicUrl }
  } = supabase.storage
    .from("book-covers")
    .getPublicUrl(filePath);

  return publicUrl;
}

/* =========================================================
   COVER
========================================================= */

function Cover({ p, large = false }) {
  const image =
    p?.image ||
    p?.image_url ||
    "";

  if (image) {
    return (
      <div
        className={
          "cover imageCover " +
          (large ? "large" : "")
        }
      >
        <img
          src={image}
          alt={p?.title || "Book cover"}
        />
      </div>
    );
  }

  return (
    <div
      className={
        "cover " +
        (large ? "large" : "")
      }
    >
      <small>BOOKMANDI</small>

      <div className="coverEmoji">
        📚
      </div>

      <strong>
        {p?.title || "Book"}
      </strong>

      <i>
        {p?.author || ""}
      </i>
    </div>
  );
}

/* =========================================================
   HEADER
========================================================= */

function Header({
  count,
  q,
  setQ
}) {
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
            onChange={(e) =>
              setQ(e.target.value)
            }
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

/* =========================================================
   STORE
========================================================= */

function Store() {
  const nav = useNavigate();

  const [
    products,
    setProducts
  ] = useState([]);

  const [q, setQ] =
    useState("");

  const [cat, setCat] =
    useState("All");

  const [cart, setCart] =
    useState(() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            "bm_cart"
          ) || "[]"
        );
      } catch {
        return [];
      }
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const data =
          await getProducts();

        setProducts(data);
      } catch (err) {
        console.error(err);
        setError(
          "Books load nahi ho paayi."
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

  const filtered =
    useMemo(() => {
      return products.filter((p) => {

        const categoryMatch =
          cat === "All" ||
          p.genre === cat;

        const searchText =
          `${p.title} ${p.author} ${p.genre}`
            .toLowerCase();

        const searchMatch =
          !q ||
          searchText.includes(
            q.toLowerCase()
          );

        return (
          categoryMatch &&
          searchMatch
        );
      });
    }, [
      products,
      q,
      cat
    ]);

  const add = (p) => {
    setCart((current) => {

      const exists =
        current.some(
          (x) => x.id === p.id
        );

      if (exists) {
        return current.map((x) =>
          x.id === p.id
            ? {
                ...x,
                qty: Math.min(
                  x.qty + 1,
                  p.stock
                )
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
  };

  const count =
    cart.reduce(
      (a, x) =>
        a + x.qty,
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
              <em>
                Prices you won't expect.
              </em>
            </h1>

            <p>
              Good books, low prices,
              zero delivery drama.
              Online payment gets the
              lower price. COD is available too.
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
                  className={
                    "heroBook h" + i
                  }
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

          <label>
            TODAY'S SHELVES
          </label>

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
                  cat === c
                    ? "on"
                    : ""
                }
                onClick={() =>
                  setCat(c)
                }
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
              <h3>
                Books load nahi hui.
              </h3>
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
                          (1 -
                            p.price /
                              p.mrp) *
                            100
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
                        nav(
                          "/product/" +
                            p.id
                        )
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
                        {money(
                          p.price
                        )}
                      </b>

                      <del>
                        {money(
                          p.mrp
                        )}
                      </del>

                      <i>
                        {discount}% OFF
                      </i>

                    </div>

                    <p>
                      Online{" "}
                      {money(
                        p.price
                      )}
                      {" · "}
                      COD{" "}
                      {money(
                        p.codPrice
                      )}
                    </p>

                    <button
                      className="add"
                      disabled={
                        !p.stock
                      }
                      onClick={() =>
                        add(p)
                      }
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
                Try another search
                or category.
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
              A good book shouldn't
              need a rich-person budget.
            </h2>
          </div>

          <div>
            <b>01</b>
            <h3>
              Clear prices
            </h3>
            <p>
              Online and COD prices
              are shown before you buy.
            </p>
          </div>

          <div>
            <b>02</b>
            <h3>
              Free delivery
            </h3>
            <p>
              No surprise shipping
              line at checkout.
            </p>
          </div>

          <div>
            <b>03</b>
            <h3>
              Pay your way
            </h3>
            <p>
              Online for the lower
              price, COD when you prefer.
            </p>
          </div>

        </section>

      </main>

      <footer>
        BookMandi · Books. Kam Daam. No Drama.

        <button
          onClick={() =>
            nav("/admin")
          }
        >
          Admin
        </button>
      </footer>
    </>
  );
}

/* =========================================================
   PRODUCT PAGE
========================================================= */

function ProductPage() {
  const { pathname } =
    useLocation();

  const id =
    pathname.split("/").pop();

  const nav =
    useNavigate();

  const [p, setP] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [cart, setCart] =
    useState(() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            "bm_cart"
          ) || "[]"
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

    if (id) load();
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

        <h3>
          Book not found.
        </h3>

        <button
          className="primary"
          onClick={() =>
            nav("/")
          }
        >
          Back to BookMandi
        </button>

      </div>
    );
  }

  const add = () => {

    setCart((current) => {

      const exists =
        current.some(
          (x) => x.id === p.id
        );

      if (exists) {
        return current.map((x) =>
          x.id === p.id
            ? {
                ...x,
                qty: Math.min(
                  x.qty + 1,
                  p.stock
                )
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

  const cartCount =
    cart.reduce(
      (a, x) =>
        a + x.qty,
      0
    );

  return (
    <>
      <div className="simpleTop">

        <button
          onClick={() =>
            nav("/")
          }
        >
          ← BookMandi
        </button>

        <button
          onClick={() =>
            nav("/cart")
          }
        >
          Bag ({cartCount})
        </button>

      </div>

      <main className="productPage">

        <div>

          <Cover
            p={p}
            large
          />

          {p.gallery.length > 0 && (

            <div className="gallery">

              {p.gallery.map(
                (url) => (
                  <img
                    key={url}
                    src={url}
                    alt={p.title}
                  />
                )
              )}

            </div>

          )}

        </div>

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

/* =========================================================
   CART
========================================================= */

function Cart() {
  const nav =
    useNavigate();

  const [cart, setCart] =
    useState(() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            "bm_cart"
          ) || "[]"
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

  const count =
    cart.reduce(
      (a, x) =>
        a + x.qty,
      0
    );

  const total =
    cart.reduce(
      (a, x) =>
        a +
        x.qty *
          Number(
            x.price || 0
          ),
      0
    );

  const change = (
    id,
    delta
  ) => {

    setCart((current) =>
      current.flatMap((x) => {

        if (x.id !== id) {
          return [x];
        }

        const max =
          Number(x.stock || 999);

        const newQty =
          Math.min(
            x.qty + delta,
            max
          );

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
          onClick={() =>
            nav("/")
          }
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
            {count !== 1
              ? "s"
              : ""}
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
                    {money(
                      x.price
                    )}
                    {" "}online ·{" "}
                    {money(
                      x.codPrice
                    )}
                    {" "}COD
                  </p>

                  <div className="qty">

                    <button
                      onClick={() =>
                        change(
                          x.id,
                          -1
                        )
                      }
                    >
                      −
                    </button>

                    <b>
                      {x.qty}
                    </b>

                    <button
                      onClick={() =>
                        change(
                          x.id,
                          1
                        )
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
                    x.price *
                      x.qty
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

/* =========================================================
   CHECKOUT
========================================================= */

function Checkout() {
  const nav =
    useNavigate();

  const [cart] =
    useState(() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            "bm_cart"
          ) || "[]"
        );
      } catch {
        return [];
      }
    });

  const [
    method,
    setMethod
  ] = useState("ONLINE");

  const [form, setForm] =
    useState({
      name: "",
      phone: "",
      address: "",
      city: "",
      pincode: ""
    });

  const [msg, setMsg] =
    useState("");

  const total =
    cart.reduce(
      (a, x) =>
        a +
        x.qty *
          (method === "COD"
            ? x.codPrice
            : x.price),
      0
    );

  const field = (
    key,
    placeholder
  ) => (
    <input
      required
      placeholder={placeholder}
      value={form[key]}
      onChange={(e) =>
        setForm({
          ...form,
          [key]:
            e.target.value
        })
      }
    />
  );

  async function submit(e) {
    e.preventDefault();

    setMsg(
      "Payment/order system ko Cashfree ke saath connect karna next step hai."
    );
  }

  return (
    <div className="page">

      <div className="simpleTop">

        <button
          onClick={() =>
            nav("/cart")
          }
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

          <form
            onSubmit={submit}
          >

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
                  setMethod(
                    "ONLINE"
                  )
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
              Place order ·{" "}
              {money(total)}
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
              Payment:{" "}
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

/* =========================================================
   ADMIN
========================================================= */

function Admin() {

  const nav =
    useNavigate();

  const [
    session,
    setSession
  ] = useState(null);

  const [
    checking,
    setChecking
  ] = useState(true);

  const [
    products,
    setProducts
  ] = useState([]);

  const [
    orders,
    setOrders
  ] = useState([]);

  const [
    tab,
    setTab
  ] = useState("products");

  const [
    msg,
    setMsg
  ] = useState("");

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    form,
    setForm
  ] = useState({
    title: "",
    author: "",
    genre: "Fiction",
    description: "",
    mrp: "",
    price: "",
    codPrice: "",
    stock: "",
    active: true
  });

  const [
    frontFile,
    setFrontFile
  ] = useState(null);

  const [
    galleryFiles,
    setGalleryFiles
  ] = useState([]);

  const [
    frontPreview,
    setFrontPreview
  ] = useState("");

  useEffect(() => {

    async function loadSession() {

      const {
        data
      } =
        await supabase.auth.getSession();

      setSession(
        data.session
      );

      setChecking(false);
    }

    loadSession();

    const {
      data: listener
    } =
      supabase.auth.onAuthStateChange(
        (_event, newSession) => {
          setSession(
            newSession
          );
        }
      );

    return () => {
      listener.subscription.unsubscribe();
    };

  }, []);

  async function loadAdminData() {

    setMsg("");

    const {
      data: productData,
      error: productError
    } =
      await supabase
        .from("products")
        .select("*")
        .order("created_at", {
          ascending: false
        });

    if (productError) {
      setMsg(
        productError.message
      );
    } else {
      setProducts(
        (productData || [])
          .map(mapProduct)
      );
    }

    const {
      data: orderData,
      error: orderError
    } =
      await supabase
        .from("orders")
        .select("*")
        .order("created_at", {
          ascending: false
        });

    if (!orderError) {
      setOrders(
        orderData || []
      );
    }
  }

  useEffect(() => {

    if (!session) return;

    loadAdminData();

  }, [session]);

  function resetForm() {

    setForm({
      title: "",
      author: "",
      genre: "Fiction",
      description: "",
      mrp: "",
      price: "",
      codPrice: "",
      stock: "",
      active: true
    });

    setFrontFile(null);
    setGalleryFiles([]);
    setFrontPreview("");
  }

  function updateForm(
    key,
    value
  ) {

    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function selectFront(
    file
  ) {

    if (!file) return;

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setMsg(
        "Front cover image select karo."
      );
      return;
    }

    setFrontFile(file);

    setFrontPreview(
      URL.createObjectURL(file)
    );
  }

  function selectGallery(
    files
  ) {

    const images =
      Array.from(files || [])
        .filter((file) =>
          file.type.startsWith(
            "image/"
          )
        );

    setGalleryFiles(images);
  }

  async function createProduct(
    e
  ) {

    e.preventDefault();

    setMsg("");

    if (!form.title.trim()) {
      setMsg(
        "Book name required hai."
      );
      return;
    }

    if (!form.author.trim()) {
      setMsg(
        "Author required hai."
      );
      return;
    }

    if (!form.description.trim()) {
      setMsg(
        "Description required hai."
      );
      return;
    }

    if (!frontFile) {
      setMsg(
        "Front cover image upload karo."
      );
      return;
    }

    const mrp =
      Number(form.mrp);

    const price =
      Number(form.price);

    const codPrice =
      Number(form.codPrice);

    const stock =
      Number(form.stock);

    if (
      !mrp ||
      !price ||
      !codPrice ||
      stock < 0
    ) {
      setMsg(
        "Prices aur stock check karo."
      );
      return;
    }

    if (price > mrp) {
      setMsg(
        "Online price MRP se zyada nahi ho sakti."
      );
      return;
    }

    if (codPrice < price) {
      setMsg(
        "COD price online price se kam nahi honi chahiye."
      );
      return;
    }

    try {

      setSaving(true);

      setMsg(
        "Uploading front cover..."
      );

      const frontUrl =
        await uploadImage(
          frontFile
        );

      setMsg(
        "Uploading other images..."
      );

      const galleryUrls = [];

      for (
        const file of galleryFiles
      ) {

        const url =
          await uploadImage(
            file
          );

        if (url) {
          galleryUrls.push(
            url
          );
        }
      }

      setMsg(
        "Saving book..."
      );

      const {
        error
      } =
        await supabase
          .from("products")
          .insert({
            title:
              form.title.trim(),

            author:
              form.author.trim(),

            genre:
              form.genre,

            description:
              form.description.trim(),

            mrp,

            price,

            cod_price:
              codPrice,

            stock,

            image_url:
              frontUrl,

            gallery_urls:
              galleryUrls,

            active:
              form.active
          });

      if (error) {
        throw error;
      }

      resetForm();

      await loadAdminData();

      setTab(
        "products"
      );

      setMsg(
        "Book added successfully ✓"
      );

    } catch (error) {

      console.error(error);

      setMsg(
        error.message ||
          "Book save nahi hui."
      );

    } finally {

      setSaving(false);

    }
  }

  async function saveProduct(
    p
  ) {

    try {

      setSaving(true);
      setMsg("");

      const {
        error
      } =
        await supabase
          .from("products")
          .update({
            price:
              Number(p.price),

            cod_price:
              Number(
                p.codPrice
              ),

            mrp:
              Number(p.mrp),

            stock:
              Number(p.stock),

            active:
              Boolean(p.active),

            updated_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            p.id
          );

      if (error) {
        throw error;
      }

      setMsg(
        `"${p.title}" saved ✓`
      );

      await loadAdminData();

    } catch (error) {

      console.error(error);

      setMsg(
        error.message
      );

    } finally {

      setSaving(false);

    }
  }

  async function deleteProduct(
    p
  ) {

    const yes =
      window.confirm(
        `Delete "${p.title}"?`
      );

    if (!yes) return;

    try {

      setSaving(true);

      const {
        error
      } =
        await supabase
          .from("products")
          .delete()
          .eq(
            "id",
            p.id
          );

      if (error) {
        throw error;
      }

      setMsg(
        "Product deleted ✓"
      );

      await loadAdminData();

    } catch (error) {

      console.error(error);

      setMsg(
        error.message
      );

    } finally {

      setSaving(false);

    }
  }

  async function signIn(
    e
  ) {

    e.preventDefault();

    const data =
      new FormData(
        e.currentTarget
      );

    const email =
      String(
        data.get("email") || ""
      );

    const password =
      String(
        data.get("password") || ""
      );

    setMsg("");

    const {
      error
    } =
      await supabase.auth
        .signInWithPassword({
          email,
          password
        });

    if (error) {
      setMsg(
        error.message
      );
    }
  }

  async function logout() {

    await supabase.auth
      .signOut();

    setSession(null);
  }

  if (checking) {

    return (
      <div className="loading">
        Opening control room...
      </div>
    );
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

        <p className="adminIntro">
          Manage your entire bookstore
          from here.
        </p>

        <form
          onSubmit={signIn}
        >

          <input
            name="email"
            type="email"
            required
            placeholder="Admin email"
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
          <p className="errorText">
            {msg}
          </p>
        )}

      </div>
    );
  }

  return (
    <div className="admin">

      <div className="adminTop">

        <button
          onClick={() =>
            nav("/")
          }
        >
          ← Store
        </button>

        <button
          onClick={logout}
        >
          Log out
        </button>

      </div>

      <div className="adminTitle">

        <div>

          <label>
            CONTROL ROOM
          </label>

          <h1>
            BookMandi Admin
          </h1>

          <p>
            Add books, manage prices,
            stock and orders.
          </p>

        </div>

        <button
          className="primary"
          onClick={() =>
            setTab("add")
          }
        >
          + Add new book
        </button>

      </div>

      <div className="stats">

        <div>
          <b>
            {products.length}
          </b>
          Products
        </div>

        <div>
          <b>
            {
              products.filter(
                (p) =>
                  p.active
              ).length
            }
          </b>
          Live
        </div>

        <div>
          <b>
            {
              products.filter(
                (p) =>
                  p.stock <= 0
              ).length
            }
          </b>
          Out of stock
        </div>

        <div>
          <b>
            {orders.length}
          </b>
          Orders
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
            tab === "add"
              ? "on"
              : ""
          }
          onClick={() =>
            setTab("add")
          }
        >
          + Add book
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

      {msg && (
        <div className="adminMessage">
          {msg}
        </div>
      )}

      {/* ===================================================
          ADD BOOK
      =================================================== */}

      {tab === "add" && (

        <section className="addBook">

          <div className="addBookHeader">

            <div>

              <label>
                NEW PRODUCT
              </label>

              <h2>
                Put a book on the shelf.
              </h2>

              <p>
                Fill the details,
                upload the covers,
                hit publish.
              </p>

            </div>

          </div>

          <form
            className="bookForm"
            onSubmit={
              createProduct
            }
          >

            <div className="formSection">

              <div className="formSectionTitle">
                <span>01</span>

                <div>
                  <h3>
                    Book information
                  </h3>

                  <p>
                    Basic details customers
                    will see.
                  </p>
                </div>
              </div>

              <div className="formGrid">

                <label>
                  Book name

                  <input
                    value={
                      form.title
                    }
                    onChange={(e) =>
                      updateForm(
                        "title",
                        e.target.value
                      )
                    }
                    placeholder="e.g. Atomic Habits"
                    required
                  />
                </label>

                <label>
                  Author

                  <input
                    value={
                      form.author
                    }
                    onChange={(e) =>
                      updateForm(
                        "author",
                        e.target.value
                      )
                    }
                    placeholder="e.g. James Clear"
                    required
                  />
                </label>

                <label>
                  Category

                  <select
                    value={
                      form.genre
                    }
                    onChange={(e) =>
                      updateForm(
                        "genre",
                        e.target.value
                      )
                    }
                  >
                    {CATS
                      .filter(
                        (c) =>
                          c !== "All"
                      )
                      .map((c) => (
                        <option
                          key={c}
                          value={c}
                        >
                          {c}
                        </option>
                      ))}
                  </select>

                </label>

                <label>
                  Stock

                  <input
                    type="number"
                    min="0"
                    value={
                      form.stock
                    }
                    onChange={(e) =>
                      updateForm(
                        "stock",
                        e.target.value
                      )
                    }
                    placeholder="10"
                    required
                  />
                </label>

                <label className="fullField">
                  Description

                  <textarea
                    value={
                      form.description
                    }
                    onChange={(e) =>
                      updateForm(
                        "description",
                        e.target.value
                      )
                    }
                    placeholder="Write a useful description of the book..."
                    rows="6"
                    required
                  />

                </label>

              </div>

            </div>

            <div className="formSection">

              <div className="formSectionTitle">

                <span>02</span>

                <div>
                  <h3>
                    Pricing
                  </h3>

                  <p>
                    Online price can be
                    lower than COD.
                  </p>
                </div>

              </div>

              <div className="formGrid priceGrid">

                <label>
                  MRP

                  <div className="moneyInput">
                    <span>₹</span>

                    <input
                      type="number"
                      min="1"
                      value={
                        form.mrp
                      }
                      onChange={(e) =>
                        updateForm(
                          "mrp",
                          e.target.value
                        )
                      }
                      placeholder="799"
                      required
                    />
                  </div>

                </label>

                <label>
                  Online price

                  <div className="moneyInput">
                    <span>₹</span>

                    <input
                      type="number"
                      min="1"
                      value={
                        form.price
                      }
                      onChange={(e) =>
                        updateForm(
                          "price",
                          e.target.value
                        )
                      }
                      placeholder="179"
                      required
                    />
                  </div>

                  <small>
                    Lower prepaid price
                  </small>

                </label>

                <label>
                  COD price

                  <div className="moneyInput">
                    <span>₹</span>

                    <input
                      type="number"
                      min="1"
                      value={
                        form.codPrice
                      }
                      onChange={(e) =>
                        updateForm(
                          "codPrice",
                          e.target.value
                        )
                      }
                      placeholder="199"
                      required
                    />
                  </div>

                  <small>
                    Cash on delivery price
                  </small>

                </label>

              </div>

            </div>

            <div className="formSection">

              <div className="formSectionTitle">

                <span>03</span>

                <div>
                  <h3>
                    Book images
                  </h3>

                  <p>
                    Front cover becomes
                    the main product image.
                  </p>
                </div>

              </div>

              <div className="uploadGrid">

                <div className="uploadBox mainUpload">

                  <label
                    className="uploadLabel"
                    htmlFor="front-image"
                  >

                    {frontPreview ? (

                      <img
                        src={
                          frontPreview
                        }
                        alt="Front preview"
                      />

                    ) : (

                      <div className="uploadPlaceholder">

                        <strong>
                          + Upload front cover
                        </strong>

                        <span>
                          JPG, PNG or WEBP
                        </span>

                      </div>

                    )}

                  </label>

                  <input
                    id="front-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      selectFront(
                        e.target.files?.[0]
                      )
                    }
                    hidden
                  />

                  {frontFile && (
                    <small>
                      {frontFile.name}
                    </small>
                  )}

                </div>

                <div className="uploadBox">

                  <label
                    className="uploadLabel galleryUpload"
                    htmlFor="gallery-images"
                  >

                    <div className="uploadPlaceholder">

                      <strong>
                        + Add other images
                      </strong>

                      <span>
                        Back cover, pages,
                        inside shots...
                      </span>

                    </div>

                  </label>

                  <input
                    id="gallery-images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      selectGallery(
                        e.target.files
                      )
                    }
                    hidden
                  />

                  {galleryFiles.length >
                    0 && (

                    <div className="selectedFiles">

                      {galleryFiles.map(
                        (file) => (
                          <span
                            key={
                              file.name +
                              file.size
                            }
                          >
                            {file.name}
                          </span>
                        )
                      )}

                    </div>

                  )}

                </div>

              </div>

            </div>

            <div className="formBottom">

              <label className="publishToggle">

                <input
                  type="checkbox"
                  checked={
                    form.active
                  }
                  onChange={(e) =>
                    updateForm(
                      "active",
                      e.target.checked
                    )
                  }
                />

                <span>
                  Publish immediately
                </span>

              </label>

              <div>

                <button
                  type="button"
                  className="secondary"
                  onClick={
                    resetForm
                  }
                  disabled={saving}
                >
                  Clear
                </button>

                <button
                  className="primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Publishing..."
                    : "Publish book →"}
                </button>

              </div>

            </div>

          </form>

        </section>

      )}

      {/* ===================================================
          PRODUCTS
      =================================================== */}

      {tab === "products" && (

        <section>

          <div className="adminHead">

            <div>
              <label>
                INVENTORY
              </label>

              <h2>
                Your books
              </h2>
            </div>

            <span>
              {msg}
            </span>

          </div>

          <div className="adminTable">

            {products.length === 0 ? (

              <div className="empty">
                <b>📚</b>
                <h3>
                  No books yet.
                </h3>
                <p>
                  Add your first book.
                </p>
              </div>

            ) : (

              products.map(
                (p) => (

                  <div
                    className="adminRow"
                    key={p.id}
                  >

                    <div className="adminProductInfo">

                      <div className="miniCover">

                        {p.image ? (

                          <img
                            src={
                              p.image
                            }
                            alt=""
                          />

                        ) : (
                          "📚"
                        )}

                      </div>

                      <div>

                        <b>
                          {p.title}
                        </b>

                        <small>
                          {p.author}
                        </small>

                        <em>
                          {p.genre}
                        </em>

                      </div>

                    </div>

                    <label>
                      MRP

                      <input
                        type="number"
                        value={
                          p.mrp
                        }
                        onChange={(e) =>
                          setProducts(
                            products.map(
                              (x) =>
                                x.id ===
                                p.id
                                  ? {
                                      ...x,
                                      mrp:
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
                      Online

                      <input
                        type="number"
                        value={
                          p.price
                        }
                        onChange={(e) =>
                          setProducts(
                            products.map(
                              (x) =>
                                x.id ===
                                p.id
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
                                x.id ===
                                p.id
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
                        min="0"
                        value={
                          p.stock
                        }
                        onChange={(e) =>
                          setProducts(
                            products.map(
                              (x) =>
                                x.id ===
                                p.id
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

                    <label className="activeField">

                      Live

                      <input
                        type="checkbox"
                        checked={
                          p.active
                        }
                        onChange={(e) =>
                          setProducts(
                            products.map(
                              (x) =>
                                x.id ===
                                p.id
                                  ? {
                                      ...x,
                                      active:
                                        e.target
                                          .checked
                                    }
                                  : x
                            )
                          )
                        }
                      />

                    </label>

                    <button
                      className="saveButton"
                      disabled={
                        saving
                      }
                      onClick={() =>
                        saveProduct(
                          p
                        )
                      }
                    >
                      Save
                    </button>

                    <button
                      className="deleteButton"
                      disabled={
                        saving
                      }
                      onClick={() =>
                        deleteProduct(
                          p
                        )
                      }
                    >
                      Delete
                    </button>

                  </div>

                )
              )

            )}

          </div>

        </section>

      )}

      {/* ===================================================
          ORDERS
      =================================================== */}

      {tab === "orders" && (

        <section>

          <div className="adminHead">

            <div>
              <label>
                SALES
              </label>

              <h2>
                Orders
              </h2>
            </div>

            <span>
              {orders.length} total
            </span>

          </div>

          {orders.length ? (

            <div className="ordersList">

              {orders.map(
                (o) => (

                  <div
                    className="order"
                    key={o.id}
                  >

                    <div>

                      <b>
                        Order
                      </b>

                      <small>
                        {o.id}
                      </small>

                    </div>

                    <span>
                      {o.customer_name}
                    </span>

                    <span>
                      {o.customer_phone}
                    </span>

                    <span>
                      {o.payment_method}
                    </span>

                    <strong>
                      {money(
                        o.total
                      )}
                    </strong>

                    <em>
                      {o.status}
                    </em>

                  </div>

                )
              )}

            </div>

          ) : (

            <div className="empty">

              <b>📦</b>

              <h3>
                No orders yet.
              </h3>

              <p>
                Orders will appear here.
              </p>

            </div>

          )}

        </section>

      )}

    </div>
  );
}

/* =========================================================
   APP ROUTER
========================================================= */

function App() {

  const path =
    useLocation()
      .pathname;

  if (
    path === "/cart"
  ) {
    return <Cart />;
  }

  if (
    path === "/checkout"
  ) {
    return <Checkout />;
  }

  if (
    path.startsWith(
      "/product/"
    )
  ) {
    return <ProductPage />;
  }

  if (
    path === "/admin"
  ) {
    return <Admin />;
  }

  return <Store />;
}

createRoot(
  document.getElementById(
    "root"
  )
).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);