import React, {useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {BrowserRouter,useLocation,useNavigate} from "react-router-dom";
import "./styles.css";

const CATS=["All","Fiction","Self Help","Mystery","Finance","Coding","Romance","Students","Hindi","Kids"];
const api=(url,opt={})=>fetch(url,{...opt,headers:{"Content-Type":"application/json",...(opt.headers||{})}}).then(async r=>{const d=r.status===204?null:await r.json();if(!r.ok)throw Error(d?.error||"Request failed");return d});
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN");

function Cover({p,large=false}) {
  return <div className={"cover "+(large?"large":"")}><small>BOOKMANDI</small><div className="coverEmoji">{p?.image||"📚"}</div><strong>{p?.title||"Book"}</strong><i>{p?.author||""}</i></div>
}

function Header({count,q,setQ}) {
  const nav=useNavigate();
  return <header><div className="nav">
    <button className="logo" onClick={()=>nav("/")}>B <span>BookMandi</span></button>
    <div className="search">⌕<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search books, authors..."/></div>
    <button className="bag" onClick={()=>nav("/cart")}>Bag <b>{count}</b></button>
  </div></header>
}

function Store() {
  const nav=useNavigate(),[products,setProducts]=useState([]),[q,setQ]=useState(""),[cat,setCat]=useState("All"),[cart,setCart]=useState(()=>JSON.parse(localStorage.getItem("bm_cart")||"[]"));
  useEffect(()=>{api("/api/products").then(setProducts).catch(console.error)},[]);
  useEffect(()=>localStorage.setItem("bm_cart",JSON.stringify(cart)),[cart]);
  const filtered=useMemo(()=>products.filter(p=>(cat==="All"||p.genre===cat)&&(!q||`${p.title} ${p.author} ${p.genre}`.toLowerCase().includes(q.toLowerCase()))),[products,q,cat]);
  const add=p=>setCart(c=>c.some(x=>x.id===p.id)?c.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x):[...c,{...p,qty:1}]);
  const count=cart.reduce((a,x)=>a+x.qty,0);
  return <><Header count={count} q={q} setQ={setQ}/><main>
    <section className="hero"><div><label>THE INTERNET'S LITTLE BOOK MANDI</label><h1>Books you want.<br/><em>Prices you won't expect.</em></h1><p>Good books, low prices, zero delivery drama. Online payment gets the lower price. COD is available too.</p><button className="primary" onClick={()=>document.getElementById("shop").scrollIntoView({behavior:"smooth"})}>Browse the mandi ↓</button></div><div className="heroVisual">{products.slice(0,3).map((p,i)=><div className={"heroBook h"+i} key={p.id}><Cover p={p}/></div>)}</div></section>
    <div className="trust"><span><b>FREE DELIVERY</b>Every order</span><span><b>PAY YOUR WAY</b>UPI · Cards · COD</span><span><b>LOW PRICES</b>Clear pricing</span></div>
    <section id="shop" className="shop"><label>TODAY'S SHELVES</label><div className="sectionTitle"><h2>Find your next read.</h2><span>{filtered.length} books</span></div>
      <div className="chips">{CATS.map(c=><button key={c} className={cat===c?"on":""} onClick={()=>setCat(c)}>{c}</button>)}</div>
      {filtered.length?<div className="grid">{filtered.map(p=><article className="product" key={p.id}><button className="coverBtn" onClick={()=>nav("/product/"+p.id)}><Cover p={p}/></button><label>{p.genre}</label><h3>{p.title}</h3><small>{p.author}</small><div className="price"><b>{money(p.price)}</b><del>{money(p.mrp)}</del><i>{Math.max(0,Math.round((1-p.price/p.mrp)*100))}% OFF</i></div><p>Online {money(p.price)} · COD {money(p.codPrice)}</p><button className="add" onClick={()=>add(p)}>Add to bag</button></article>)}</div>:<div className="empty"><b>📚</b><h3>Nothing on this shelf.</h3><p>Try another search or category.</p></div>}
    </section>
    <section className="why"><div><label>WAIT, WHY SO CHEAP?</label><h2>A good book shouldn't need a rich-person budget.</h2></div><div><b>01</b><h3>Clear prices</h3><p>Online and COD prices are shown before you buy.</p></div><div><b>02</b><h3>Free delivery</h3><p>No surprise shipping line at checkout.</p></div><div><b>03</b><h3>Pay your way</h3><p>Online for the lower price, COD when you prefer.</p></div></section>
  </main><footer>BookMandi · Books. Kam Daam. No Drama. <button onClick={()=>nav("/admin")}>Admin</button></footer></>
}

function ProductPage(){
  const {pathname}=useLocation(),id=pathname.split("/").pop(),nav=useNavigate(),[p,setP]=useState(null),[cart,setCart]=useState(()=>JSON.parse(localStorage.getItem("bm_cart")||"[]"));
  useEffect(()=>{api("/api/products").then(x=>setP(x.find(a=>a.id===id)||null))},[id]);
  useEffect(()=>localStorage.setItem("bm_cart",JSON.stringify(cart)),[cart]);
  if(!p)return <div className="loading">Loading book...</div>;
  const add=()=>{setCart(c=>c.some(x=>x.id===p.id)?c.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x):[...c,{...p,qty:1}]);nav("/cart")};
  return <><div className="simpleTop"><button onClick={()=>nav("/")}>← BookMandi</button><button onClick={()=>nav("/cart")}>Bag ({cart.reduce((a,x)=>a+x.qty,0)})</button></div><main className="productPage"><Cover p={p} large/><div className="productCopy"><label>{p.genre}</label><h1>{p.title}</h1><p className="author">{p.author}</p><p>{p.description}</p><div className="priceBig">{money(p.price)} <del>{money(p.mrp)}</del></div><div className="payOptions"><div><b>ONLINE</b><strong>{money(p.price)}</strong><small>Lower price</small></div><div><b>COD</b><strong>{money(p.codPrice)}</strong><small>Cash on delivery</small></div></div><p className="green">✓ Free delivery</p><p className="stock">{p.stock>0?`${p.stock} in stock`:"Currently out of stock"}</p><button className="primary full" disabled={!p.stock} onClick={add}>{p.stock?"Add to bag":"Out of stock"}</button></div></main></>
}

function Cart(){
  const nav=useNavigate(),[cart,setCart]=useState(()=>JSON.parse(localStorage.getItem("bm_cart")||"[]"));
  useEffect(()=>localStorage.setItem("bm_cart",JSON.stringify(cart)),[cart]);
  const count=cart.reduce((a,x)=>a+x.qty,0),total=cart.reduce((a,x)=>a+x.qty*x.price,0);
  const change=(id,d)=>setCart(c=>c.flatMap(x=>x.id===id?(x.qty+d>0?[{...x,qty:x.qty+d}]:[]):[x]));
  return <div className="page"><div className="simpleTop"><button onClick={()=>nav("/")}>← Continue shopping</button></div><div className="cartPage"><div><label>YOUR BAG</label><h1>{count} item{count!==1?"s":""}</h1>{cart.length?cart.map(x=><div className="cartRow" key={x.id}><Cover p={x}/><div><h3>{x.title}</h3><small>{x.author}</small><p>{money(x.price)} online · {money(x.codPrice)} COD</p><div className="qty"><button onClick={()=>change(x.id,-1)}>−</button><b>{x.qty}</b><button onClick={()=>change(x.id,1)}>+</button></div></div></div>):<div className="empty"><b>🛍️</b><h3>Your bag is empty.</h3></div>}</div>{cart.length>0&&<aside className="summary"><label>ORDER SUMMARY</label>{cart.map(x=><p key={x.id}>{x.title} × {x.qty}<b>{money(x.price*x.qty)}</b></p>)}<hr/><div className="total"><span>Online total</span><strong>{money(total)}</strong></div><small className="green">✓ Free delivery</small><button className="primary full" onClick={()=>nav("/checkout")}>Checkout</button></aside>}</div></div>
}

function Checkout(){
  const nav=useNavigate(),[cart,setCart]=useState(()=>JSON.parse(localStorage.getItem("bm_cart")||"[]")),[method,setMethod]=useState("ONLINE"),[form,setForm]=useState({name:"",phone:"",address:"",city:"",pincode:""}),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
  const total=cart.reduce((a,x)=>a+x.qty*(method==="COD"?x.codPrice:x.price),0);
  const field=(k,p)=> <input required placeholder={p} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>;
  async function submit(e){e.preventDefault();if(!cart.length)return;setBusy(true);setMsg("");try{const r=await api("/api/orders",{method:"POST",body:JSON.stringify({items:cart.map(x=>({productId:x.id,qty:x.qty})),customer:form,paymentMethod:method})});if(method==="COD"){localStorage.removeItem("bm_cart");setMsg("Order placed successfully: "+r.orderId);setCart([])}else{const s=document.createElement("script");s.src="https://checkout.razorpay.com/v1/checkout.js";s.onload=()=>{const rz=new window.Razorpay({key:r.razorpay.keyId,amount:r.razorpay.amount,currency:"INR",name:"BookMandi",description:"Book order",order_id:r.razorpay.id,handler:async response=>{await api("/api/payments/verify",{method:"POST",body:JSON.stringify({...response,orderId:r.orderId})});localStorage.removeItem("bm_cart");setCart([]);setMsg("Payment successful. Order: "+r.orderId)},modal:{ondismiss:()=>setBusy(false)}});rz.open()};document.body.appendChild(s)}}catch(x){setMsg(x.message)}finally{if(method==="COD")setBusy(false)}} 
  return <div className="page"><div className="simpleTop"><button onClick={()=>nav("/cart")}>← Bag</button></div><main className="checkout"><label>SECURE CHECKOUT</label><h1>Almost there.</h1>{msg&&<div className="notice">{msg}</div>}<div className="checkoutGrid"><form onSubmit={submit}>{field("name","Full name")}{field("phone","Phone number")}{field("address","Full delivery address")}<div className="two">{field("city","City")}{field("pincode","Pincode")}</div><div className="methods"><button type="button" className={method==="ONLINE"?"selected":""} onClick={()=>setMethod("ONLINE")}><b>ONLINE</b><strong>{money(cart.reduce((a,x)=>a+x.qty*x.price,0))}</strong><small>UPI · Cards · Netbanking</small></button><button type="button" className={method==="COD"?"selected":""} onClick={()=>setMethod("COD")}><b>COD</b><strong>{money(cart.reduce((a,x)=>a+x.qty*x.codPrice,0))}</strong><small>Cash on delivery</small></button></div><button disabled={busy} className="primary full">{busy?"Processing...":"Place order · "+money(total)}</button></form><aside className="summary"><label>YOUR TOTAL</label><h2>{money(total)}</h2><p>Payment: <b>{method==="COD"?"Cash on Delivery":"Online"}</b></p><p className="green">✓ Free delivery</p></aside></div></main></div>
}

function Admin(){
  const nav=useNavigate(),[token,setToken]=useState(localStorage.getItem("bm_admin")||""),[login,setLogin]=useState({email:"",password:""}),[products,setProducts]=useState([]),[orders,setOrders]=useState([]),[tab,setTab]=useState("products"),[msg,setMsg]=useState("");
  const headers={Authorization:`Bearer ${token}`};
  const load=()=>{api("/api/admin/products",{headers}).then(setProducts).catch(()=>setToken(""));api("/api/admin/orders",{headers}).then(setOrders).catch(()=>{})};
  useEffect(()=>{if(token)load()},[token]);
  async function signIn(){try{const r=await api("/api/admin/login",{method:"POST",body:JSON.stringify(login)});localStorage.setItem("bm_admin",r.token);setToken(r.token)}catch(e){setMsg(e.message)}}
  async function save(p){try{await api("/api/admin/products/"+p.id,{method:"PUT",headers,body:JSON.stringify(p)});setMsg("Saved ✓");load()}catch(e){setMsg(e.message)}}
  if(!token)return <div className="admin login"><label>BOOKMANDI CONTROL ROOM</label><h1>Admin login</h1><input placeholder="Email" onChange={e=>setLogin({...login,email:e.target.value})}/><input type="password" placeholder="Password" onChange={e=>setLogin({...login,password:e.target.value})}/><button className="primary full" onClick={signIn}>Enter dashboard</button><p>{msg}</p></div>;
  return <div className="admin"><div className="adminTop"><button onClick={()=>nav("/")}>← Store</button><button onClick={()=>{localStorage.removeItem("bm_admin");setToken("")}}>Log out</button></div><label>CONTROL ROOM</label><h1>BookMandi Admin</h1><div className="stats"><div><b>{products.length}</b>Products</div><div><b>{orders.length}</b>Orders</div><div><b>{money(orders.reduce((a,o)=>a+Number(o.total||0),0))}</b>Order value</div></div><div className="tabs"><button className={tab==="products"?"on":""} onClick={()=>setTab("products")}>Products</button><button className={tab==="orders"?"on":""} onClick={()=>setTab("orders")}>Orders</button></div>{tab==="products"?<><div className="adminHead"><h2>Products</h2><span>{msg}</span></div><div className="adminTable">{products.map(p=><div className="adminRow" key={p.id}><div><b>{p.title}</b><small>{p.author}</small></div><label>Online<input type="number" value={p.price} onChange={e=>setProducts(products.map(x=>x.id===p.id?{...x,price:+e.target.value}:x))}/></label><label>COD<input type="number" value={p.codPrice} onChange={e=>setProducts(products.map(x=>x.id===p.id?{...x,codPrice:+e.target.value}:x))}/></label><label>Stock<input type="number" value={p.stock} onChange={e=>setProducts(products.map(x=>x.id===p.id?{...x,stock:+e.target.value}:x))}/></label><button onClick={()=>save(p)}>Save</button></div>)}</div></>:<div>{orders.length?orders.map(o=><div className="order" key={o.id}><b>{o.id}</b><span>{o.customer?.name}</span><span>{o.paymentMethod}</span><span>{money(o.total)}</span><strong>{o.status}</strong></div>):<div className="empty">No orders yet.</div>}</div>}</div>
}

function App(){const path=useLocation().pathname;if(path==="/cart")return <Cart/>;if(path==="/checkout")return <Checkout/>;if(path.startsWith("/product/"))return <ProductPage/>;if(path==="/admin")return <Admin/>;return <Store/>}
createRoot(document.getElementById("root")).render(<BrowserRouter><App/></BrowserRouter>);
