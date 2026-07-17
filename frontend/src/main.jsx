import React,{useCallback,useEffect,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{Bell,CheckCircle,Eye,EyeOff,LineChart,LogIn,LogOut,MapPin,Pencil,Plus,Shield,ShoppingBasket,Store,Trash2,TrendingDown,TrendingUp,Upload,User,Users,Wallet}from'lucide-react';
import sokopriceLogo from '../../images/sokopricelogo.png';
import{Bar,BarChart,Cell,Line,LineChart as RLineChart,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis}from'recharts';
import'./styles.css';

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const MARKETS=['Kimironko','Nyabugogo','Kicukiro','Kimisagara','Kigali City'];
const COMMODITIES=['Maize','Maize Flour','Potatoes','Rice','Beans (Dry)','Sorghum','Bananas','Spinach','Cabbage','Flour'];
const MARKET_COORDS={'Kimironko':{lat:-1.9441,lon:30.1074},'Nyabugogo':{lat:-1.9359,lon:30.0547},'Kicukiro':{lat:-1.9706,lon:30.0878},'Kimisagara':{lat:-1.9592,lon:30.0442},'Kigali City':{lat:-1.9500,lon:30.0619}};

// African market and produce images
const MARKET_IMAGES={
  'Kimironko':'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80',
  'Nyabugogo':'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=80',
  'Kicukiro':'/kicukiro.jpeg',
  'Kimisagara':'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80',
  'Kigali City':'/kigali.png.jpeg',
};

const PALETTE=['#087a3a','#ff6b00','#d7b84a','#845ec2','#6c9a36','#e74c3c','#3498db'];
const money=n=>Math.round(n||0).toLocaleString();
const nextWeek=()=>new Date(Date.now()+7*24*60*60*1000).toISOString().split('T')[0];

function haversine(la1,lo1,la2,lo2){
  const R=6371,dL=(la2-la1)*Math.PI/180,dO=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dO/2)**2;
  return(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(1);
}
const distTo=(m,u)=>u&&MARKET_COORDS[m]?haversine(u.lat,u.lon,MARKET_COORDS[m].lat,MARKET_COORDS[m].lon):null;

// API client
function useApi(){
  const tok=()=>localStorage.getItem('sp_token');
  const h=()=>({'Content-Type':'application/json','Authorization':`Bearer ${tok()}`});
  const post=async(p,b)=>{try{const r=await fetch(API_BASE+p,{method:'POST',headers:h(),body:JSON.stringify(b)});const d=await r.json();if(!r.ok)throw d;return d;}catch{return null;}};
  const get=async p=>{try{const r=await fetch(API_BASE+p,{headers:h()});const d=await r.json();if(!r.ok)throw d;return d;}catch{return null;}};
  const put=async(p,b)=>{try{const r=await fetch(API_BASE+p,{method:'PUT',headers:h(),body:JSON.stringify(b)});const d=await r.json();if(!r.ok)throw d;return d;}catch{return null;}};
  const del=async p=>{try{const r=await fetch(API_BASE+p,{method:'DELETE',headers:h()});const d=await r.json();if(!r.ok)throw d;return d;}catch{return null;}};
  const upl=async(p,fd)=>{try{const r=await fetch(API_BASE+p,{method:'POST',headers:{'Authorization':`Bearer ${tok()}`},body:fd});const d=await r.json();if(!r.ok)throw d;return d;}catch{return null;}};
  return{post,get,put,del,upl};
}

function useLocation(){
  const[loc,setLoc]=useState(null);
  useEffect(()=>{if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(p=>setLoc({lat:p.coords.latitude,lon:p.coords.longitude}),()=>setLoc(null));},[]);
  return loc;
}

const AuthCtx=React.createContext(null);
const useAuth=()=>React.useContext(AuthCtx);

// Leaflet map
function LeafletMap({userLoc,selectedMarket,onSelectMarket,basketMarket}){
  const ref=useRef(null);
  const mapRef=useRef(null);
  useEffect(()=>{
    if(mapRef.current||!ref.current)return;
    function init(){
      const L=window.L;
      const center=userLoc?[userLoc.lat,userLoc.lon]:[-1.9500,30.0588];
      const map=L.map(ref.current).setView(center,13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OpenStreetMap contributors'}).addTo(map);
      if(userLoc){
        const ui=L.divIcon({html:'<div style="background:#087a3a;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>',iconSize:[16,16],iconAnchor:[8,8],className:''});
        L.marker([userLoc.lat,userLoc.lon],{icon:ui}).addTo(map).bindPopup('Your Location');
      }
      Object.entries(MARKET_COORDS).forEach(([name,c])=>{
        const isSel=name===selectedMarket;
        const isBest=name===basketMarket;
        const bg=isBest?'#ff6b00':isSel?'#0aab50':'#087a3a';
        const icon=L.divIcon({html:`<div style="background:${bg};color:white;padding:4px 9px;border-radius:16px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid white">${name}${isBest?' Best':''}</div>`,iconAnchor:[0,10],className:''});
        L.marker([c.lat,c.lon],{icon}).addTo(map).bindPopup(`<b>${name}</b>`).on('click',()=>onSelectMarket&&onSelectMarket(name));
      });
      mapRef.current=map;
    }
    if(window.L){init();}else{
      const lk=document.createElement('link');lk.rel='stylesheet';lk.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(lk);
      const sc=document.createElement('script');sc.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';sc.onload=init;document.head.appendChild(sc);
    }
  },[]);
  return <div ref={ref} style={{height:320,borderRadius:12,overflow:'hidden',zIndex:1}}/>;
}

// Shared components
function Card({children,style,className=''}){return <div className={`card ${className}`} style={style}>{children}</div>;}
function Stat({icon,label,value,sub,color='#087a3a'}){
  return(
    <Card style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px'}}>
      <div style={{width:44,height:44,borderRadius:10,background:`${color}15`,display:'grid',placeItems:'center',color,flexShrink:0}}>{icon}</div>
      <div>
        <div style={{fontSize:11,color:'#667085',fontWeight:600,textTransform:'uppercase',letterSpacing:.4}}>{label}</div>
        <div style={{fontSize:19,fontWeight:700,lineHeight:1.2}}>{value}</div>
        {sub&&<div style={{fontSize:12,color:'#667085',marginTop:2}}>{sub}</div>}
      </div>
    </Card>
  );
}
function Sel({label,value,onChange,items,style}){return(<label className="select" style={style}>{label&&<span>{label}</span>}<select value={value} onChange={e=>onChange(e.target.value)}>{items.map(i=><option key={i}>{i}</option>)}</select></label>);}
function Inp({label,type='text',value,onChange,placeholder,style}){return(<label className="select" style={style}>{label&&<span>{label}</span>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>);}
function Badge({children,color='#087a3a'}){return <span style={{background:`${color}18`,color,padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700,display:'inline-block'}}>{children}</span>;}
function TrendBadge({trend}){
  const c={rising:{color:'#d92d20',icon:<TrendingUp size={12}/>,label:'Rising'},falling:{color:'#087a3a',icon:<TrendingDown size={12}/>,label:'Falling'},stable:{color:'#667085',icon:null,label:'Stable'}}[trend]||{color:'#667085',icon:null,label:'Stable'};
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,color:c.color,fontSize:13,fontWeight:700}}>{c.icon}{c.label}</span>;
}
function Spinner(){return <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:48}}><div style={{width:34,height:34,border:'3px solid #e5e9ef',borderTopColor:'#087a3a',borderRadius:'50%',animation:'sp 1s linear infinite'}}/><style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style></div>;}
function HeroImg(){
  return(
    <div className="hero-img" style={{borderRadius:16,overflow:'hidden',position:'relative',background:'linear-gradient(135deg,#0a5c2b,#0d8a3e)'}}>
      <div style={{position:'absolute',inset:0,background:'url(https://images.unsplash.com/photo-1542838132-92c53300491e?w=700&q=80) center/cover',opacity:.22}}/>
      <div style={{position:'absolute',bottom:24,left:24,color:'white'}}>
        <div style={{fontWeight:800,fontSize:22}}>Kigali Markets</div>
        <div style={{color:'rgba(255,255,255,.65)',fontSize:13,marginTop:4}}>AI-powered price forecasts</div>
      </div>
    </div>
  );
}

// Layout
function Layout({page,setPage,children}){
  const{user,logout}=useAuth();
  const navLabels={Sellers:'Set Prices'};
  const nav=user?.role==='seller'
    ?['Home','Sellers','Pricing','Markets','Cost Estimator','Alerts','About']
    :['Home','Pricing','Markets','Cost Estimator','Alerts','About'];
  const isAdminPage=page==='Admin';
  const[mobileNav,setMobileNav]=useState(false);
  const goTo=p=>{setPage(p);setMobileNav(false);};
  return(
    <>
      <div className="top">
          <div className="brand-logo" onClick={()=>setPage('Home')}>
          <img src={sokopriceLogo} alt="SokoPrice" className="brand-img"/>
          <span className="brand-text">SokoPrice</span>
        </div>
        {!isAdminPage&&<nav>{nav.map(n=><button key={n} className={page===n?'active':''} onClick={()=>setPage(n)} style={{fontSize:13.5}}>{navLabels[n]||n}</button>)}</nav>}
        <div className="right" style={{gap:10}}>
          {/* Hamburger — visible only on mobile, before auth buttons */}
          {!isAdminPage&&<button className={`hamburger${mobileNav?' open':''}`} onClick={()=>setMobileNav(!mobileNav)} aria-label="Toggle menu"><span/><span/><span/></button>}
          {/* Desktop-only: user badge + logout */}
          <div className="desktop-auth" style={{display:'flex',alignItems:'center',gap:10}}>
          {user?(
            <>
              <div onClick={()=>setPage(user.role==='admin'?'Admin':user.role==='seller'?'Sellers':'Home')}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',background:'#f4fbf6',borderRadius:12,cursor:'pointer',border:'1px solid #c3e6cb'}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#087a3a,#0aab50)',display:'grid',placeItems:'center',color:'white',fontSize:13,fontWeight:700}}>{user.name[0].toUpperCase()}</div>
                <div><div style={{fontSize:13,fontWeight:700,lineHeight:1}}>{user.name}</div><div style={{fontSize:11,color:'#667085',textTransform:'capitalize'}}>{user.role}</div></div>
              </div>
              <button className="ghost" onClick={logout} style={{padding:'10px 14px'}}><LogOut size={15}/></button>
            </>
          ):(
            <>
              <button className="ghost" onClick={()=>setPage('Login')} style={{padding:'10px 20px',fontSize:13.5}}><LogIn size={15}/> Sign In</button>
              <button className="primary" onClick={()=>setPage('Register')} style={{padding:'10px 20px',fontSize:13.5}}><User size={15}/> Get Started</button>
            </>
          )}
          </div>
        </div>
      </div>
      {/* Mobile nav drawer: page links + user section + logout */}
      {!isAdminPage&&(
        <div className={`mobile-nav${mobileNav?' open':''}`}>
          {user&&(
            <div className="mobile-nav-user">
              <div className="mobile-nav-avatar">{user.name[0].toUpperCase()}</div>
              <div>
                <div className="mobile-nav-name">{user.name}</div>
                <div className="mobile-nav-role">{user.role}</div>
              </div>
            </div>
          )}
          {nav.map(n=><button key={n} className={page===n?'active':''} onClick={()=>goTo(n)}>{navLabels[n]||n}</button>)}
          {user?(
            <button className="mobile-nav-logout" onClick={()=>{logout();setMobileNav(false);}}><LogOut size={18}/> Logout</button>
          ):(
            <div className="mobile-nav-auth">
              <button className="primary" onClick={()=>goTo('Login')} style={{width:'100%',marginBottom:8}}><LogIn size={16}/> Sign In</button>
              <button className="ghost" onClick={()=>goTo('Register')} style={{width:'100%'}}><User size={16}/> Get Started</button>
            </div>
          )}
        </div>
      )}
      <div style={{minHeight:isAdminPage?'100vh':'calc(100vh - 70px)'}}>{children}</div>
      {!isAdminPage&&<footer style={{background:'linear-gradient(135deg,#0a3d1f,#0d5c2e)',color:'white',padding:'18px 9%',display:'flex',alignItems:'center',justifyContent:'flex-end'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,color:'rgba(255,255,255,.5)',fontSize:13}}>
          <span style={{width:22,height:22,border:'1.5px solid rgba(255,255,255,.4)',borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11}}>©</span>
          2026 SokoPrice
        </div>
      </footer>}
    </>
  );
}

// Login
function Login({setPage}){
  const{post}=useApi();const{setUser}=useAuth();
  const[email,setEmail]=useState('');const[pw,setPw]=useState('');const[show,setShow]=useState(false);
  const[loading,setLoading]=useState(false);const[err,setErr]=useState('');
  const submit=async()=>{
    if(!email||!pw){setErr('Please fill in all fields');return;}
    setLoading(true);setErr('');
    const r=await post('/auth/login',{email,password:pw});
    setLoading(false);
    if(!r){setErr('Invalid email or password');return;}
    localStorage.setItem('sp_token',r.token);localStorage.setItem('sp_user',JSON.stringify(r.user));
    localStorage.setItem('sp_creds',btoa(email+':'+pw));setUser(r.user);
    location.hash=r.user.role==='admin'?'#admin':'';
    setPage(r.user.role==='admin'?'Admin':r.user.role==='seller'?'Sellers':'Home');
  };
  return(
    <div style={{minHeight:'85vh',display:'grid',placeItems:'center',background:'linear-gradient(135deg,#f4fbf6,#e8f5ec)'}}>
      <div className="auth-card" style={{maxWidth:420,width:'100%',background:'white',borderRadius:24,padding:44,boxShadow:'0 24px 64px rgba(0,0,0,.09)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <h2 style={{margin:0,fontSize:26}}>Welcome back</h2>
          <p style={{color:'#667085',margin:'10px 0 0',fontSize:14}}>Sign in to your SokoPrice account</p>
        </div>
        {err&&<div style={{background:'#fff5f5',border:'1px solid #fca5a5',borderRadius:10,padding:12,marginBottom:20,color:'#d92d20',fontSize:13}}>{err}</div>}
        <div style={{display:'grid',gap:16}}>
          <Inp label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com"/>
          <label className="select">
            <span>Password</span>
            <div style={{position:'relative'}}>
              <input type={show?'text':'password'} value={pw} onChange={e=>setPw(e.target.value)} placeholder="Enter your password" style={{paddingRight:44}} onKeyDown={e=>e.key==='Enter'&&submit()}/>
              <button onClick={()=>setShow(!show)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#667085',cursor:'pointer',padding:4}}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>
            </div>
          </label>
        </div>
        <button className="primary" style={{width:'100%',marginTop:24,padding:'14px 0',fontSize:15}} onClick={submit} disabled={loading}>{loading?'Signing in...':'Sign In'}</button>
        <div style={{textAlign:'center',marginTop:20,fontSize:14}}>
          <span style={{color:'#667085'}}>Don't have an account? </span>
          <button onClick={()=>setPage('Register')} style={{background:'none',border:'none',color:'#087a3a',fontWeight:700,cursor:'pointer',fontSize:14}}>Sign Up</button>
        </div>
      </div>
    </div>
  );
}

// Register
function Register({setPage}){
  const{post}=useApi();const{setUser}=useAuth();
  const[form,setForm]=useState({name:'',email:'',password:'',role:'consumer',market:'Kimironko'});
  const[loading,setLoading]=useState(false);const[err,setErr]=useState('');
  const set=k=>v=>setForm(f=>({...f,[k]:v}));
  const submit=async()=>{
    if(!form.name||!form.email||!form.password){setErr('Please fill in all fields');return;}
    setLoading(true);setErr('');
    const r=await post('/auth/register',form);
    setLoading(false);
    if(!r){setErr('Registration failed. Email may already be in use.');return;}
    localStorage.setItem('sp_token',r.token);localStorage.setItem('sp_user',JSON.stringify(r.user));
    localStorage.setItem('sp_creds',btoa(form.email+':'+form.password));setUser(r.user);
    setPage(r.user.role==='seller'?'Sellers':'Home');
  };
  return(
    <div style={{minHeight:'85vh',display:'grid',placeItems:'center',background:'linear-gradient(135deg,#f4fbf6,#e8f5ec)'}}>
      <div className="auth-card" style={{maxWidth:480,width:'100%',background:'white',borderRadius:24,padding:44,boxShadow:'0 24px 64px rgba(0,0,0,.09)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <h2 style={{margin:'0 0 8px'}}>Create your account</h2>
          <p style={{color:'#667085',margin:0,fontSize:14}}>Join SokoPrice and shop smarter</p>
        </div>
        {err&&<div style={{background:'#fff5f5',border:'1px solid #fca5a5',borderRadius:10,padding:12,marginBottom:16,color:'#d92d20',fontSize:13}}>{err}</div>}
        <div style={{display:'grid',gap:14}}>
          <Inp label="Full name" value={form.name} onChange={set('name')} placeholder="Grace Uwase"/>
          <Inp label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com"/>
          <Inp label="Password" type="password" value={form.password} onChange={set('password')} placeholder="Create a password"/>
          <div>
            <span style={{fontWeight:700,fontSize:13,display:'block',marginBottom:8}}>I am a</span>
            <div className="rg2" style={{gap:10}}>
              {['consumer','seller'].map(r=>(
                <button key={r} onClick={()=>set('role')(r)}
                  style={{padding:'12px 16px',borderRadius:10,border:`2px solid ${form.role===r?'#087a3a':'#e5e9ef'}`,background:form.role===r?'#f4fbf6':'white',color:form.role===r?'#087a3a':'#344054',fontWeight:600,cursor:'pointer',textTransform:'capitalize',transition:'all .15s'}}>
                  {r==='consumer'?'Consumer':'Seller'}
                </button>
              ))}
            </div>
          </div>
          {form.role==='seller'&&<Sel label="Your market" value={form.market} onChange={set('market')} items={MARKETS}/>}
        </div>
        <button className="primary" style={{width:'100%',marginTop:24,padding:'14px 0',fontSize:15}} onClick={submit} disabled={loading}>{loading?'Creating account...':'Create Account'}</button>
        <div style={{textAlign:'center',marginTop:18,fontSize:14}}>
          <span style={{color:'#667085'}}>Already have an account? </span>
          <button onClick={()=>setPage('Login')} style={{background:'none',border:'none',color:'#087a3a',fontWeight:700,cursor:'pointer',fontSize:14}}>Sign In</button>
        </div>
      </div>
    </div>
  );
}

// Home
function Home({setPage}){
  return(
    <main>
      <section className="rg-auto" style={{gap:28,padding:'36px 0',alignItems:'center'}}>
        <div style={{borderRadius:16,overflow:'hidden',position:'relative',minHeight:240,background:'#0a5c2b'}}>
          <img src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=500&q=80" alt="Market pricing"
            style={{width:'100%',height:'100%',objectFit:'cover',position:'absolute',opacity:.3}}/>
          <div style={{position:'absolute',bottom:20,left:20,color:'white'}}>
            <div style={{fontWeight:800,fontSize:20}}>Price Intelligence</div>
            <div style={{fontSize:13,opacity:.7,marginTop:4}}>7-day AI forecasts</div>
          </div>
        </div>
        <div>
          <h1 style={{fontSize:44,lineHeight:1.06,margin:'0 0 16px'}}>Smarter Grocery<br/><span style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Shopping Starts Here.</span></h1>
          <p style={{color:'#344054',lineHeight:1.75,fontSize:15,marginBottom:24}}>AI-powered price forecasts for Kigali's informal markets. Find the cheapest market, track price trends, and budget smarter.</p>
          <div style={{display:'flex',gap:12}}>
            <button className="primary" onClick={()=>setPage('Pricing')} style={{padding:'13px 24px',fontSize:14}}><LineChart size={16}/> View Prices</button>
            <button className="ghost" onClick={()=>setPage('Cost Estimator')} style={{padding:'13px 24px',fontSize:14}}><Wallet size={16}/> Estimate Cost</button>
          </div>
        </div>
        <div style={{display:'grid',gap:14}}>
          <Card style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',color:'white',border:'none',padding:'20px 24px'}}>
            <div style={{fontSize:12,opacity:.75,marginBottom:4}}>Today's Best Deal</div>
            <div style={{fontSize:20,fontWeight:700}}>Maize at Nyabugogo</div>
            <div style={{fontSize:32,fontWeight:800,marginTop:6}}>520 RWF/kg</div>
            <div style={{fontSize:11,opacity:.65,marginTop:10}}>AI predicted, updated today</div>
          </Card>
          <div className="rg2" style={{gap:14}}>
            {[[<LineChart size={20}/>,'AI Forecasting','7-day predictions'],[<MapPin size={20}/>,'GPS Distance','Find nearest market'],[<Wallet size={20}/>,'Basket Cost','Budget planning'],[<Bell size={20}/>,'Price Alerts','Stay informed']].map(([icon,t,d])=>(
              <Card key={t} style={{padding:'14px 16px'}}><div style={{color:'#087a3a',marginBottom:8}}>{icon}</div><div style={{fontWeight:700,fontSize:13}}>{t}</div><div style={{color:'#667085',fontSize:12,marginTop:2}}>{d}</div></Card>
            ))}
          </div>
        </div>
      </section>
      <section style={{padding:'8px 0 36px'}}>
        <h2 style={{textAlign:'center',marginBottom:6}}>Kigali's Top <span style={{color:'#087a3a'}}>Markets</span></h2>
        <p style={{textAlign:'center',color:'#667085',marginBottom:24,fontSize:14}}>Click a market to explore prices</p>
        <div className="marketcards" style={{gap:16}}>
          {MARKETS.map((m,i)=>(
            <div key={m} onClick={()=>setPage('Markets')}
              style={{borderRadius:16,overflow:'hidden',cursor:'pointer',boxShadow:'0 4px 16px rgba(0,0,0,.07)',transition:'transform .2s,box-shadow .2s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-5px)';e.currentTarget.style.boxShadow='0 12px 28px rgba(0,0,0,.12)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.07)'}}>
              <div style={{height:130,background:`url(${MARKET_IMAGES[m]}) center/cover`,position:'relative'}}>
                <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.6),transparent)'}}/>
                <div style={{position:'absolute',bottom:10,left:12,color:'white',fontWeight:700,fontSize:12.5}}>{m}</div>
              </div>
              <div style={{padding:'10px 12px',background:'white'}}><Badge color={i<2?'#087a3a':'#ff6b00'}>{i<2?'Top Market':'Active'}</Badge></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

// Pricing
function Pricing(){
  const{post}=useApi();const userLoc=useLocation();
  const[product,setProduct]=useState('Maize');const[market,setMarket]=useState('Kimironko');
  const[forecast,setForecast]=useState(null);const[compare,setCompare]=useState([]);const[loading,setLoading]=useState(false);
  const today=new Date();
  const forecastDates=Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()+i+1);return d.toISOString().split('T')[0];});
  const[forecastDate,setForecastDate]=useState(forecastDates[6]);

  const fetchData=useCallback(async()=>{
    setLoading(true);
    const[pred,recs]=await Promise.all([post('/predict',{commodity:product,market,forecast_date:forecastDate}),post('/recommend',{commodity:product,forecast_date:forecastDate})]);
    setForecast(pred);setCompare(recs||[]);setLoading(false);
  },[product,market,forecastDate]);

  useEffect(()=>{fetchData();},[fetchData]);

  const price=forecast?.predicted_price_kes||0;
  const best=compare[0]||null;
  const withDist=compare.map(r=>({...r,dist:distTo(r.market,userLoc)}));

  return(
    <main>
      <section className="rg-auto" style={{gap:28,padding:'32px 0 24px',alignItems:'start'}}>
        <div className="hero-img" style={{borderRadius:16,overflow:'hidden',position:'relative',background:'linear-gradient(135deg,#0a5c2b,#0d8a3e)',padding:'44px 32px',display:'flex',flexDirection:'column',justifyContent:'flex-end',minHeight:320}}>
          <div style={{position:'absolute',inset:0,background:'url(https://images.unsplash.com/photo-1542838132-92c53300491e?w=700&q=80) center/cover',opacity:.22}}/>
          <div style={{position:'relative',zIndex:1,color:'white'}}>
            <div style={{fontWeight:800,fontSize:22,marginBottom:4}}>Kigali Markets</div>
            <div style={{color:'rgba(255,255,255,.65)',fontSize:13,marginBottom:28}}>AI-powered price forecasts</div>
            <h1 style={{color:'white',margin:'0 0 8px',fontSize:36,lineHeight:1.15}}>Smart Prices.<br/><span style={{color:'#86efac'}}>Better Decisions.</span></h1>
            <p style={{color:'rgba(255,255,255,.8)',margin:'0 0 14px',fontSize:15}}>AI-powered forecasts across all Kigali markets, updated daily.</p>
            {userLoc?<Badge>Location detected, showing distances</Badge>:<span style={{fontSize:12,color:'rgba(255,255,255,.6)'}}>Allow location to see distances</span>}
          </div>
        </div>
        <Card>
          <h3 style={{margin:'0 0 14px'}}>Configure Forecast</h3>
          <div className="rg2" style={{gap:12,marginBottom:12}}>
            <Sel label="Product" value={product} onChange={setProduct} items={COMMODITIES}/>
            <Sel label="Market" value={market} onChange={setMarket} items={MARKETS}/>
          </div>
          <Sel label="Forecast Date" value={forecastDate} onChange={setForecastDate} items={forecastDates} style={{marginBottom:12}}/>
          <button className="orange" style={{width:'100%',padding:'13px 0',fontSize:14}} onClick={fetchData} disabled={loading}><LineChart size={16}/> {loading?'Forecasting...':'Get Forecast'}</button>
        </Card>
      </section>

      {loading?<Spinner/>:(
        <>
          <div className="forecast-summary" style={{marginBottom:24}}>
            <Stat icon={<LineChart size={18}/>} label="Predicted Price" value={`${money(price)} RWF/kg`} sub="7 days ahead"/>
            <Stat icon={<Wallet size={18}/>} label="Confidence Range" value={forecast?`${money(forecast.confidence_lower)}-${money(forecast.confidence_upper)}`:'---'} sub="90% interval"/>
            <Stat icon={<TrendingUp size={18}/>} label="Price Trend" value={<TrendBadge trend={forecast?.trend||'stable'}/>} sub="vs last month"/>
            <Card style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',color:'white',border:'none',padding:'18px 22px'}}>
              <div style={{fontSize:11,opacity:.75,marginBottom:4}}>Best Market</div>
              <div style={{fontSize:18,fontWeight:700}}>{best?.market||'---'}</div>
              <div style={{fontSize:26,fontWeight:800,marginTop:4}}>{best?`${money(best.predicted_price_kes)} RWF`:'---'}</div>
              {best&&<div style={{fontSize:11,opacity:.65,marginTop:8}}>Save {money(best.saving_vs_most_expensive)} RWF</div>}
            </Card>
          </div>
          <div className="grid2" style={{gap:20}}>
            <Card>
              <h3 style={{marginTop:0}}>{product} - Market Comparison</h3>
              <table>
                <tbody>
                  <tr><th>Market</th><th>Predicted Price</th>{userLoc&&<th>Distance</th>}<th>Saving</th><th>Status</th></tr>
                  {withDist.map((r,i)=>(
                    <tr key={r.market} style={{background:i===0?'#f4fbf6':''}}>
                      <td style={{fontWeight:600}}>{r.market}</td>
                      <td style={{fontWeight:700,color:i===0?'#087a3a':''}}>{money(r.predicted_price_kes)} RWF</td>
                      {userLoc&&<td style={{fontSize:12,color:'#667085'}}>{r.dist?`${r.dist} km`:'---'}</td>}
                      <td style={{color:'#087a3a',fontWeight:600}}>-{money(r.saving_vs_most_expensive)} RWF</td>
                      <td><Badge color={i===0?'#087a3a':i===1?'#ff6b00':'#667085'}>{i===0?'Cheapest':i===1?'Good':'Higher'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card>
              <h3 style={{marginTop:0}}>Price by Market</h3>
              <ResponsiveContainer height={230}>
                <BarChart data={withDist.map(r=>({name:r.market.split(' ')[0],price:r.predicted_price_kes}))}>
                  <XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
                  <Tooltip formatter={v=>`${money(v)} RWF`}/>
                  <Bar dataKey="price" radius={[6,6,0,0]}>{withDist.map((_,i)=><Cell key={i} fill={i===0?'#087a3a':'#c3e6cb'}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}

// Markets - clicking pin shows market listing prices
function Markets({basketItems,setPage}){
  const{post,get}=useApi();const userLoc=useLocation();
  const[selected,setSelected]=useState('Kimironko');
  const[marketListings,setMarketListings]=useState([]);
  const[loading,setLoading]=useState(false);

  const loadListings=async market=>{
    setLoading(true);
    const d=await get(`/products?market=${market}`);
    setMarketListings(d?.products||[]);setLoading(false);
  };

  useEffect(()=>{loadListings(selected);},[selected]);

  return(
    <main>
      <section style={{padding:'32px 0 20px'}}>
        <h1>Kigali <span style={{color:'#087a3a'}}>Markets</span></h1>
        <p style={{color:'#344054',fontSize:15}}>Explore markets, see seller listings, and find the best prices near you.</p>
        {userLoc?<Badge>Showing distances from your location</Badge>:<span style={{fontSize:13,color:'#667085'}}>Allow location to see distances</span>}
      </section>
      <div className="grid2" style={{marginBottom:28}}>
        <div>
          <Card style={{padding:0,overflow:'hidden',marginBottom:16}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e9ef'}}>
              <h3 style={{margin:0}}>Interactive Map</h3>
              <p style={{margin:'4px 0 0',fontSize:12,color:'#667085'}}>Click a market pin to see its listings</p>
            </div>
            <div style={{padding:16}}>
              <LeafletMap userLoc={userLoc} selectedMarket={selected} onSelectMarket={m=>{setSelected(m);loadListings(m);}}/>
            </div>
          </Card>
          <Card>
            <h3 style={{marginTop:0}}>Seller Listings at {selected}</h3>
            {loading?<Spinner/>:marketListings.length===0
              ?<div style={{textAlign:'center',padding:24,color:'#667085'}}>No listings at this market yet.</div>
              :<table>
                <tbody>
                  <tr><th>Commodity</th><th>Price</th><th>Qty</th><th>Seller</th></tr>
                  {marketListings.map(p=>(
                    <tr key={p.id}>
                      <td style={{fontWeight:600}}>{p.commodity}</td>
                      <td style={{fontWeight:700,color:'#087a3a'}}>{money(p.price_rwf)} RWF/kg</td>
                      <td>{p.quantity_kg} kg</td>
                      <td style={{fontSize:12,color:'#667085'}}>
                        {p.seller_name}
                        <button onClick={()=>{sessionStorage.setItem('sp_chat_target',JSON.stringify({partner_id:p.seller_id,partner_name:p.seller_name}));}}
                          style={{marginLeft:6,background:'#f4fbf6',border:'1px solid #c3e6cb',borderRadius:14,padding:'3px 8px',cursor:'pointer',color:'#087a3a',fontSize:10,fontWeight:600}}>
                          Chat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </Card>
        </div>
        <div className="rg2" style={{gap:14,alignContent:'start'}}>
          {MARKETS.map((m,i)=>{
            const dist=distTo(m,userLoc);const isSel=m===selected;
            return(
              <div key={m} onClick={()=>{setSelected(m);loadListings(m);}}
                style={{borderRadius:14,overflow:'hidden',cursor:'pointer',border:`2px solid ${isSel?'#087a3a':'transparent'}`,boxShadow:isSel?'0 0 0 3px #087a3a25':'0 2px 10px rgba(0,0,0,.06)',transition:'all .2s'}}>
                <div style={{height:96,background:`url(${MARKET_IMAGES[m]}) center/cover`,position:'relative'}}>
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.55),transparent)'}}/>
                  <div style={{position:'absolute',bottom:7,left:10,color:'white',fontWeight:700,fontSize:12}}>{m}</div>
                </div>
                <div style={{padding:'8px 12px',background:'white'}}>
                  {dist&&<div style={{fontSize:11,color:'#087a3a',fontWeight:600,marginBottom:4}}>{dist} km away</div>}
                  <Badge color={i<2?'#087a3a':'#ff6b00'}>{i<2?'High Activity':'Active'}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

// Cost Estimator with budget threshold and market comparison
function CostEstimator({setPage,setSharedBasket}){
  const{post}=useApi();const userLoc=useLocation();
  const[market,setMarket]=useState('Kimironko');
  const[product,setProduct]=useState('Maize');
  const[qty,setQty]=useState('1');
  const[budget,setBudget]=useState('');
  const[items,setItems]=useState([
    {commodity:'Maize',quantity_kg:2},{commodity:'Beans (Dry)',quantity_kg:1},
    {commodity:'Rice',quantity_kg:2},{commodity:'Potatoes',quantity_kg:1.5},
  ]);
  const[result,setResult]=useState(null);
  const[allMarkets,setAllMarkets]=useState([]);
  const[loading,setLoading]=useState(false);
  const[comparing,setComparing]=useState(false);

  const runBasket=async(ci=items,cm=market)=>{
    setLoading(true);
    const d=await post('/basket',{market:cm,forecast_date:nextWeek(),items:ci});
    setResult(d);setLoading(false);
  };

  const compareAllMarkets=async(ci=items)=>{
    setComparing(true);
    const results=await Promise.all(MARKETS.map(m=>post('/basket',{market:m,forecast_date:nextWeek(),items:ci})));
    setAllMarkets(results.filter(Boolean).map(r=>({...r,dist:distTo(r.market,userLoc)})).sort((a,b)=>a.total_kes-b.total_kes));
    setComparing(false);
  };

  useEffect(()=>{runBasket();},[market]);

  const addItem=()=>{
    const n=[...items,{commodity:product,quantity_kg:Number(qty)||1}];
    setItems(n);runBasket(n);
  };
  const removeItem=idx=>{const n=items.filter((_,i)=>i!==idx);setItems(n);runBasket(n);};

  const display=result?.items||items.map(i=>({...i,unit_price_kes:0,line_total_kes:0}));
  const total=result?.total_kes||0;
  const budgetNum=Number(budget)||0;
  const overBudget=budgetNum>0&&total>budgetNum;
  const underBudget=budgetNum>0&&total<=budgetNum;
  const cheapestMarket=allMarkets[0];
  const nearestAffordable=allMarkets.find(m=>!budgetNum||m.total_kes<=budgetNum);

  return(
    <main>
      <section style={{padding:'32px 0 24px'}}>
        <h1>Cost <span style={{color:'#087a3a'}}>Estimator</span></h1>
        <p style={{color:'#344054',fontSize:15}}>Build your basket, set a budget, and find the best market to shop from.</p>
      </section>
      <div className="grid2" style={{gap:24}}>
        <div style={{display:'grid',gap:16}}>
          <Card>
            <h3 style={{marginTop:0}}>Add Items</h3>
            <div className="rg-auto-sm" style={{gap:12,alignItems:'end'}}>
              <Sel label="Product" value={product} onChange={setProduct} items={COMMODITIES}/>
              <Sel label="Market" value={market} onChange={m=>{setMarket(m);runBasket(items,m);}} items={MARKETS}/>
              <Inp label="Qty (kg)" type="number" value={qty} onChange={setQty}/>
              <button className="orange" onClick={addItem} style={{marginTop:22,padding:'12px 14px',borderRadius:10}}><Plus size={16}/></button>
            </div>
            <div style={{marginTop:12,display:'flex',gap:12,alignItems:'end'}}>
              <Inp label="Budget (RWF) - optional" type="number" value={budget} onChange={setBudget} placeholder="e.g. 30000" style={{flex:1}}/>
              <button className="ghost" onClick={()=>compareAllMarkets(items)} disabled={comparing} style={{marginTop:22,padding:'12px 16px',whiteSpace:'nowrap'}}>
                {comparing?'Comparing...':'Compare All Markets'}
              </button>
            </div>
          </Card>

          {/* Budget status */}
          {budgetNum>0&&total>0&&(
            <Card style={{background:overBudget?'linear-gradient(135deg,#fff5f5,#ffe4e4)':'linear-gradient(135deg,#f4fbf6,#e8f5ec)',border:`1px solid ${overBudget?'#fca5a5':'#86efac'}`}}>
              <div style={{fontWeight:700,fontSize:17,color:overBudget?'#d92d20':'#087a3a'}}>
                {overBudget?'Over Budget by '+money(total-budgetNum)+' RWF':'Within Budget, saving '+money(budgetNum-total)+' RWF'}
              </div>
              <div style={{fontSize:13,color:'#344054',marginTop:6}}>
                Basket total: {money(total)} RWF | Budget: {money(budgetNum)} RWF at {market}
              </div>
              {overBudget&&nearestAffordable&&(
                <div style={{marginTop:10,fontSize:13,color:'#087a3a'}}>
                  Try <b>{nearestAffordable.market}</b> instead, total would be {money(nearestAffordable.total_kes)} RWF
                </div>
              )}
            </Card>
          )}

          <Card>
            <h3 style={{marginTop:0}}>Your Basket at {market}</h3>
            {loading?<Spinner/>:(
              <table>
                <tbody>
                  <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th><th></th></tr>
                  {display.map((r,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{r.commodity}</td>
                      <td>{r.quantity_kg} kg</td>
                      <td>{money(r.unit_price_kes)} RWF</td>
                      <td style={{fontWeight:700}}>{money(r.line_total_kes)} RWF</td>
                      <td><button onClick={()=>removeItem(i)} style={{background:'#fff5f5',border:'1px solid #fca5a5',borderRadius:6,padding:'4px 6px',cursor:'pointer',color:'#d92d20'}}><Trash2 size={13}/></button></td>
                    </tr>
                  ))}
                  <tr style={{borderTop:'2px solid #e5e9ef',background:'#f4fbf6'}}>
                    <td colSpan={3} style={{fontWeight:700,fontSize:16}}>Total</td>
                    <td colSpan={2} style={{fontWeight:800,fontSize:22,color:overBudget?'#d92d20':'#087a3a'}}>{money(total)} RWF</td>
                  </tr>
                </tbody>
              </table>
            )}
          </Card>

          {/* All markets comparison */}
          {allMarkets.length>0&&(
            <Card>
              <h3 style={{marginTop:0}}>Same Basket Across All Markets</h3>
              <table>
                <tbody>
                  <tr><th>Market</th><th>Total</th>{userLoc&&<th>Distance</th>}<th>Budget Status</th><th>Saving</th></tr>
                  {allMarkets.map((m,i)=>{
                    const isOver=budgetNum>0&&m.total_kes>budgetNum;
                    return(
                      <tr key={m.market} style={{background:i===0?'#f4fbf6':''}}>
                        <td style={{fontWeight:600}}>{m.market}</td>
                        <td style={{fontWeight:700,color:i===0?'#087a3a':isOver?'#d92d20':''}}>{money(m.total_kes)} RWF</td>
                        {userLoc&&<td style={{fontSize:12,color:'#667085'}}>{m.dist?`${m.dist} km`:'---'}</td>}
                        <td>{budgetNum>0?<Badge color={isOver?'#d92d20':'#087a3a'}>{isOver?'Over Budget':'Within Budget'}</Badge>:'---'}</td>
                        <td style={{color:'#087a3a'}}>{i>0?`-${money(m.total_kes-allMarkets[0].total_kes)} RWF`:<Badge color="#087a3a">Cheapest</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{marginTop:16}}>
                <button className="primary" onClick={()=>{setSharedBasket&&setSharedBasket(items);setPage('Markets');}} style={{padding:'12px 20px',fontSize:13}}>
                  <MapPin size={14}/> View Nearest Market on Map
                </button>
              </div>
            </Card>
          )}
        </div>

        <div style={{display:'grid',gap:16,alignContent:'start'}}>
          <Card style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',color:'white',border:'none',padding:'22px'}}>
            <div style={{fontSize:11,opacity:.75}}>Basket Total at</div>
            <div style={{fontSize:20,fontWeight:700,marginTop:4}}>{market}</div>
            <div style={{fontSize:36,fontWeight:800,marginTop:8}}>{money(total)} RWF</div>
            {budgetNum>0&&<div style={{marginTop:12,padding:'8px 12px',background:'rgba(255,255,255,.15)',borderRadius:8,fontSize:13}}>{overBudget?`${money(total-budgetNum)} RWF over budget`:`${money(budgetNum-total)} RWF remaining`}</div>}
          </Card>
          <Card>
            <h3 style={{marginTop:0}}>Breakdown</h3>
            <ResponsiveContainer height={190}>
              <PieChart>
                <Pie data={display.map(r=>({name:r.commodity,value:r.line_total_kes||0}))} dataKey="value" outerRadius={72} innerRadius={38}>
                  {display.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                </Pie>
                <Tooltip formatter={v=>`${money(v)} RWF`}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{marginTop:18}}>
              <div style={{fontWeight:700,fontSize:12,marginBottom:10,color:'#344054'}}>Commodity Colors</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px 16px'}}>
                {display.map((r,i)=><div key={r.commodity} style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:12,height:12,borderRadius:3,background:PALETTE[i%PALETTE.length],flexShrink:0}}/><span style={{fontSize:12,fontWeight:500}}>{r.commodity}</span></div>)}
              </div>
            </div>
          </Card>
          <button className="orange" onClick={()=>runBasket()} disabled={loading} style={{padding:'14px 0',borderRadius:10}}>{loading?'Recalculating...':'Recalculate'}</button>
        </div>
      </div>

      {/* Map showing nearest and most affordable */}
      {allMarkets.length>0&&(
        <Card style={{marginTop:20,padding:0,overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e9ef'}}>
            <h3 style={{margin:0}}>Find the Best Market Near You</h3>
            <p style={{margin:'4px 0 0',fontSize:12,color:'#667085'}}>
              Orange pin shows the cheapest market for your basket{budgetNum>0?' within your budget':''}.
              {userLoc?' Green pin is your location.':''}
            </p>
          </div>
          <div style={{padding:16}}>
            <LeafletMap userLoc={userLoc} selectedMarket={cheapestMarket?.market} onSelectMarket={()=>{}} basketMarket={cheapestMarket?.market}/>
          </div>
        </Card>
      )}
    </main>
  );
}

// Alerts - AI-powered threshold alerts tied to predictions
function Alerts(){
  const{get}=useApi();
  const[commodity,setCommodity]=useState('Maize');
  const[market,setMarket]=useState('Kimironko');
  const[threshold,setThreshold]=useState('1000');
  const[result,setResult]=useState(null);
  const[allAlerts,setAllAlerts]=useState([]);
  const[loading,setLoading]=useState(false);

  const check=async()=>{
    setLoading(true);
    const d=await get(`/alerts/${commodity}?threshold_kes=${threshold}&market=${market}`);
    setResult(d);setLoading(false);
  };

  // Auto-check alerts for all commodities at default thresholds
  const loadAllAlerts=async()=>{
    const defaults={'Maize':600,'Beans (Dry)':1500,'Rice':1200,'Potatoes':800,'Maize Flour':500};
    const results=await Promise.all(
      Object.entries(defaults).map(async([c,t])=>{
        const d=await get(`/alerts/${c}?threshold_kes=${t}&market=Kimironko`);
        return d?{...d,threshold_kes:t}:null;
      })
    );
    setAllAlerts(results.filter(Boolean));
  };

  useEffect(()=>{check();loadAllAlerts();},[]);
  useEffect(()=>{if(commodity&&market&&threshold)check();},[commodity,market,threshold]);

  return(
    <main>
      <section style={{padding:'32px 0 24px'}}>
        <h1>Price <span style={{color:'#087a3a'}}>Alerts</span></h1>
        <p style={{color:'#344054',fontSize:15}}>AI-predicted alerts based on current forecasts and your budget thresholds.</p>
      </section>
      <div className="grid2" style={{gap:24,gridTemplateColumns:'1fr 1.2fr'}}>
        <div style={{display:'grid',gap:16,alignContent:'start'}}>
          <Card>
            <h3 style={{marginTop:0}}>Check a Price Alert</h3>
            <div style={{display:'grid',gap:14}}>
              <Sel label="Commodity" value={commodity} onChange={setCommodity} items={COMMODITIES}/>
              <Sel label="Market" value={market} onChange={setMarket} items={MARKETS}/>
              <Inp label="Budget Threshold (RWF/kg)" type="number" value={threshold} onChange={setThreshold}/>
              <button className="orange" onClick={check} disabled={loading} style={{padding:'13px 0'}}><Bell size={16}/> {loading?'Checking...':'Check Alert'}</button>
            </div>
          </Card>
          {result&&(
            <Card style={{background:result.alert?'linear-gradient(135deg,#fff5f5,#ffe4e4)':'linear-gradient(135deg,#f4fbf6,#e8f5ec)',border:`1px solid ${result.alert?'#fca5a5':'#86efac'}`}}>
              <div style={{fontWeight:700,fontSize:17,color:result.alert?'#d92d20':'#087a3a'}}>{result.alert?'Price Alert Active':'Within Budget'}</div>
              <div style={{fontSize:30,fontWeight:800,margin:'10px 0',color:result.alert?'#d92d20':'#087a3a'}}>{money(result.predicted_price_kes)} RWF/kg</div>
              <div style={{fontSize:13,color:'#344054'}}>{result.message}</div>
              <div style={{display:'flex',gap:10,marginTop:12}}><Badge color={result.alert?'#d92d20':'#087a3a'}>{result.alert?'Over Threshold':'Within Budget'}</Badge><TrendBadge trend={result.trend}/></div>
            </Card>
          )}
        </div>
        <Card>
          <h3 style={{marginTop:0}}>Live Price Watch</h3>
          <p style={{fontSize:13,color:'#667085',marginBottom:16}}>AI-predicted alerts based on current forecasts at Kimironko. Updated each time you visit.</p>
          <table>
            <tbody>
              <tr><th>Commodity</th><th>Predicted Price</th><th>Threshold</th><th>Trend</th><th>Status</th></tr>
              {allAlerts.map((a,i)=>(
                <tr key={i}>
                  <td style={{fontWeight:600}}>{a.commodity}</td>
                  <td style={{fontWeight:700,color:a.alert?'#d92d20':'#087a3a'}}>{money(a.predicted_price_kes)} RWF</td>
                  <td>{money(a.threshold_kes)} RWF</td>
                  <td><TrendBadge trend={a.trend}/></td>
                  <td><Badge color={a.alert?'#d92d20':'#087a3a'}>{a.alert?'Alert':'OK'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </main>
  );
}

// Sellers - full CRUD with real-time chart
function Sellers(){
  const{get,post,put,del}=useApi();const{user}=useAuth();
  const[products,setProducts]=useState([]);const[insights,setInsights]=useState(null);
  const[loading,setLoading]=useState(false);const[chartData,setChartData]=useState([]);
  const[form,setForm]=useState({commodity:'Maize',market:'Kimironko',price_rwf:'',quantity_kg:'1',unit:'kg'});
  const[editId,setEditId]=useState(null);const[editPrice,setEditPrice]=useState('');
  const set=k=>v=>setForm(f=>({...f,[k]:v}));

  const load=async()=>{
    setLoading(true);const d=await get('/seller/products');
    if(d)setProducts(d.products);setLoading(false);
  };

  const[submissions,setSubmissions]=useState([]);
  const loadSubmissions=async()=>{
    const d=await get('/seller/submissions');
    if(d)setSubmissions(d.submissions||[]);
  };

  const loadInsights=async c=>{
    const d=await get(`/seller/insights/${c}`);
    if(d){setInsights(d);setChartData(d.market_prices.map(m=>({name:m.market.split(' ')[0],ai:m.ai_price})));}
  };

  useEffect(()=>{if(user&&(user.role==='seller'||user.role==='admin')){load();loadSubmissions();loadInsights(form.commodity);}},[ user]);

  const addProduct=async()=>{
    if(!form.price_rwf)return;
    await post('/seller/products',{...form,price_rwf:Number(form.price_rwf),quantity_kg:Number(form.quantity_kg)||1});
    load();set('price_rwf')('');
  };
  const saveEdit=async id=>{await put(`/seller/products/${id}`,{price_rwf:Number(editPrice)});setEditId(null);load();loadSubmissions();};
  const remove=async id=>{if(!confirm('Delete this listing?'))return;await del(`/seller/products/${id}`);load();};

  // Real-time price entry: submit for admin approval
  const[newPrice,setNewPrice]=useState('');
  const[newDate,setNewDate]=useState(new Date().toISOString().split('T')[0]);

  const submitRealPrice=async()=>{
    if(!newPrice||!form.commodity||!form.market)return;
    const result=await post('/seller/submit-price',{
      commodity:form.commodity,market:form.market,
      price_rwf:Number(newPrice),price_date:newDate
    });
    if(result){alert(result.message||'Price submitted for admin review.');loadSubmissions();}
    else{alert('Failed to submit price. Please try again.');}
    setNewPrice('');
  };

  if(!user||user.role==='consumer'){
    return(
      <main style={{textAlign:'center',padding:'80px 0'}}>
        <h2 style={{marginBottom:12}}>Seller <span style={{color:'#087a3a'}}>Dashboard</span></h2>
        <p style={{color:'#667085',marginBottom:24,fontSize:15}}>Sign in as a seller to manage your listings and track prices.</p>
      </main>
    );
  }

  return(
    <main>
      <section style={{padding:'32px 0 24px'}} className="rg-auto" >
        <div>
          <h1 style={{margin:0}}>Seller <span style={{color:'#087a3a'}}>Dashboard</span></h1>
          <p style={{color:'#344054',marginTop:8}}>Manage listings and track AI price comparisons in real time.</p>
        </div>
      </section>
      <div className="grid2" style={{gap:24}}>
        <div style={{display:'grid',gap:16}}>
          <Card>
            <h3 style={{marginTop:0}}>Add New Listing</h3>
            <div className="rg2" style={{gap:12}}>
              <Sel label="Commodity" value={form.commodity} onChange={v=>{set('commodity')(v);loadInsights(v);}} items={COMMODITIES}/>
              <Sel label="Market" value={form.market} onChange={set('market')} items={MARKETS}/>
              <Inp label="Your Price (RWF/kg)" type="number" value={form.price_rwf} onChange={set('price_rwf')} placeholder="e.g. 520"/>
              <Inp label="Quantity (kg)" type="number" value={form.quantity_kg} onChange={set('quantity_kg')}/>
            </div>
            <button className="primary" style={{marginTop:14,padding:'13px 0',width:'100%'}} onClick={addProduct}><Plus size={16}/> Add Listing</button>
          </Card>

          <Card>
            <h3 style={{marginTop:0}}>Submit Real Price to Model</h3>
            <p style={{fontSize:13,color:'#667085'}}>Enter today's actual market price. This feeds into the AI model to improve predictions.</p>
            <div className="rg-auto-sm" style={{gap:12,alignItems:'end'}}>
              <Sel label="Commodity" value={form.commodity} onChange={v=>{set('commodity')(v);loadInsights(v);}} items={COMMODITIES}/>
              <Sel label="Market" value={form.market} onChange={set('market')} items={MARKETS}/>
              <Inp label="Actual Price (RWF)" type="number" value={newPrice} onChange={setNewPrice} placeholder="e.g. 480"/>
              <button className="orange" onClick={submitRealPrice} style={{marginTop:22,padding:'12px 14px',borderRadius:10}}><Upload size={14}/></button>
            </div>
            <p style={{fontSize:12,color:'#667085',marginTop:10}}>Date: {newDate}. Your submission helps improve forecasts for all users.</p>
          </Card>

          <Card>
            <h3 style={{marginTop:0}}>My Listings</h3>
            {loading?<Spinner/>:products.length===0
              ?<div style={{textAlign:'center',padding:28,color:'#667085'}}>No listings yet. Add your first product above.</div>
              :<table>
                <tbody>
                  <tr><th>Product</th><th>Market</th><th>Your Price</th><th>AI Price</th><th>Status</th><th>Actions</th></tr>
                  {products.map(p=>(
                    <tr key={p.id}>
                      <td style={{fontWeight:600}}>{p.commodity}</td>
                      <td style={{fontSize:12}}>{p.market}</td>
                      <td>{editId===p.id
                        ?<div style={{display:'flex',gap:6}}><input type="number" value={editPrice} onChange={e=>setEditPrice(e.target.value)} style={{width:80,padding:'4px 8px',border:'1px solid #e5e9ef',borderRadius:6,fontSize:13}}/><button onClick={()=>saveEdit(p.id)} style={{background:'#087a3a',color:'white',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:12}}>Save</button><button onClick={()=>setEditId(null)} style={{background:'#f4f4f4',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:12}}>X</button></div>
                        :<b>{money(p.price_rwf)} RWF</b>
                      }</td>
                      <td style={{color:'#087a3a',fontWeight:600}}>{money(p.ai_price_rwf)} RWF</td>
                      <td><Badge color={p.price_status==='above_market'?'#d92d20':p.price_status==='below_market'?'#087a3a':'#667085'}>{p.price_status==='above_market'?'Above Market':p.price_status==='below_market'?'Below Market':'At Market'}</Badge></td>
                      <td><div style={{display:'flex',gap:6}}>
                        <button onClick={()=>{setEditId(p.id);setEditPrice(p.price_rwf);}} style={{background:'#f4fbf6',border:'1px solid #c3e6cb',borderRadius:6,padding:'5px 8px',cursor:'pointer',color:'#087a3a'}}><Pencil size={12}/></button>
                        <button onClick={()=>remove(p.id)} style={{background:'#fff5f5',border:'1px solid #fca5a5',borderRadius:6,padding:'5px 8px',cursor:'pointer',color:'#d92d20'}}><Trash2 size={12}/></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </Card>

          <Card>
            <h3 style={{marginTop:0}}>My Price Submissions</h3>
            <p style={{fontSize:12,color:'#667085',marginBottom:12}}>Track the review status of prices you've submitted to improve the AI model.</p>
            {submissions.length===0
              ?<div style={{textAlign:'center',padding:20,color:'#667085',fontSize:13}}>No price submissions yet. Submit a real price above.</div>
              :<table>
                <tbody>
                  <tr><th>Commodity</th><th>Market</th><th>Price</th><th>Date</th><th>Status</th></tr>
                  {submissions.map(s=>(
                    <tr key={s.id}>
                      <td style={{fontWeight:600}}>{s.commodity}</td>
                      <td style={{fontSize:12}}>{s.market}</td>
                      <td style={{fontWeight:700,color:'#087a3a'}}>{money(s.price_rwf)} RWF</td>
                      <td style={{fontSize:12}}>{s.price_date}</td>
                      <td><Badge color={s.status==='approved'?'#087a3a':s.status==='rejected'?'#d92d20':'#ff6b00'}>{s.status==='approved'?'Approved':s.status==='rejected'?'Rejected':'Pending'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </Card>
        </div>

        <div style={{display:'grid',gap:16,alignContent:'start'}}>
          <div style={{position:'relative',borderRadius:16,overflow:'hidden',width:'100%',height:360,margin:'-12px 0 -2px'}}>
            <img src="/seller.png" alt="Happy market seller" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            {/* Keep hero coverage behind the next card, but make it transparent around where the next text starts */}
            <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg, rgba(8,122,58,0) 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,0) 64%, rgba(0,0,0,0.22) 80%, rgba(0,0,0,0.28) 100%)'}}/>
            <div style={{position:'absolute',bottom:24,left:24,right:24}}>
              <div style={{background:'rgba(0,0,0,.35)',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)',display:'inline-block',padding:'5px 14px',borderRadius:8}}>
                <span style={{color:'rgba(255,255,255,.92)',fontSize:12}}>Manage your market presence</span>
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:16}}>
            <Stat icon={<Store size={16}/>} label="Listings" value={products.length} color="#087a3a"/>
            <Stat icon={<Bell size={16}/>} label="Above Market" value={products.filter(p=>p.price_status==='above_market').length} color="#d92d20"/>
          </div>
          {insights&&(
            <Card>
              <h3 style={{marginTop:0}}>Market Prices - {insights.commodity}</h3>
              <div className="rg2" style={{gap:10,marginBottom:14}}>
                <div style={{background:'#f4fbf6',borderRadius:10,padding:12}}>
                  <div style={{fontSize:11,color:'#667085'}}>Cheapest Market</div>
                  <div style={{fontWeight:700,color:'#087a3a',marginTop:2}}>{insights.cheapest}</div>
                </div>
                <div style={{background:'#fff5f5',borderRadius:10,padding:12}}>
                  <div style={{fontSize:11,color:'#667085'}}>Most Expensive</div>
                  <div style={{fontWeight:700,color:'#d92d20',marginTop:2}}>{insights.most_expensive}</div>
                </div>
              </div>

              {/* Real-time price chart */}
              <div style={{marginBottom:8,fontSize:13,fontWeight:600,color:'#344054'}}>AI Forecast vs Your Price</div>
              <ResponsiveContainer height={200}>
                <BarChart data={chartData.map(d=>{
                  const myProduct=products.find(p=>p.commodity===insights.commodity&&p.market===MARKETS.find(m=>m.split(' ')[0]===d.name));
                  return{...d,yours:myProduct?.price_rwf||null};
                })}>
                  <XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
                  <Tooltip formatter={v=>`${money(v)} RWF`}/>
                  <Bar dataKey="ai" name="AI Forecast" fill="#c3e6cb" radius={[4,4,0,0]}/>
                  <Bar dataKey="yours" name="Your Price" fill="#087a3a" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{marginTop:18}}>
                <div style={{fontWeight:700,fontSize:12,marginBottom:10,color:'#344054'}}>Chart Legend</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'8px 16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:12,height:12,borderRadius:3,background:'#c3e6cb',flexShrink:0}}/><span style={{fontSize:12,fontWeight:500}}>AI Forecast</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:12,height:12,borderRadius:3,background:'#087a3a',flexShrink:0}}/><span style={{fontSize:12,fontWeight:500}}>Your Price</span></div>
                </div>
              </div>
            </Card>
          )}
          <Card>
            <h3 style={{marginTop:0}}>Pricing Guide</h3>
            {[['Below Market','Your price is lower than AI forecast, great for attracting buyers','#087a3a'],['At Market','Your price matches the AI forecast closely','#ff6b00'],['Above Market','Your price is higher than the AI forecast, consider adjusting','#d92d20']].map(([t,d,c])=>(
              <div key={t} style={{display:'flex',gap:10,padding:'10px 12px',background:'#f8f9fa',borderRadius:8,marginBottom:8}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:c,marginTop:3,flexShrink:0}}/>
                <div><div style={{fontWeight:700,fontSize:13}}>{t}</div><div style={{fontSize:12,color:'#667085',marginTop:2}}>{d}</div></div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </main>
  );
}

// About
function About(){
  return(
    <main>
      <section className="rg-auto" style={{gap:28,padding:'32px 0',alignItems:'center'}}>
        <HeroImg/>
        <div>
          <h1>About <span style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>SokoPrice</span></h1>
          <p style={{lineHeight:1.8,fontSize:15}}>SokoPrice is an AI-powered platform helping Kigali shoppers make smarter grocery decisions with accurate price forecasts, market comparisons, and GPS-based distance recommendations.</p>
        </div>
      </section>
      <div className="rg2" style={{gap:20}}>
        {[['Mission','Empower Kigali households with AI-driven price insights that reduce information asymmetry between vendors and consumers.'],['Vision','A future where every Kigali household has equal access to market intelligence for fair, informed purchasing.']].map(([t,d])=>(
          <Card key={t}><h3 style={{marginTop:0}}>{t}</h3><p style={{color:'#344054',fontSize:14,lineHeight:1.75,margin:0}}>{d}</p></Card>
        ))}
      </div>
    </main>
  );
}

// Admin - hidden, only via #admin hash
function Admin(){
  const{get,post,put,upl}=useApi();const{user}=useAuth();
  const[stats,setStats]=useState(null);const[users,setUsers]=useState([]);
  const[products,setProducts]=useState([]);const[tab,setTab]=useState('overview');
  const[uploading,setUploading]=useState(false);const[uploadMsg,setUploadMsg]=useState('');
  const[retraining,setRetraining]=useState(false);const[retrainResult,setRetrainResult]=useState(null);const[retrainError,setRetrainError]=useState('');
  const fileRef=useRef(null);
  const[pendingSubs,setPendingSubs]=useState([]);

  const loadPendingSubs=async()=>{
    const d=await get('/admin/pending-submissions');
    if(d)setPendingSubs(d.submissions||[]);
  };
  const approveSub=async id=>{
    await post('/admin/approve-submission/'+id,{});
    loadPendingSubs();get('/admin/stats').then(d=>d&&setStats(d));
  };
  const rejectSub=async id=>{
    await post('/admin/reject-submission/'+id,{});
    loadPendingSubs();
  };

  useEffect(()=>{
    if(!user||user.role!=='admin')return;
    get('/admin/stats').then(d=>d&&setStats(d));
    get('/admin/users').then(d=>d&&setUsers(d.users));
    get('/admin/products').then(d=>d&&setProducts(d.products));
  },[user]);

  useEffect(()=>{
    if(tab==='pending'&&user&&user.role==='admin')loadPendingSubs();
  },[tab,user]);

  const suspendUser=async id=>{await put(`/admin/users/${id}/suspend`,{});get('/admin/users').then(d=>d&&setUsers(d.users));};
  const handleUpload=async e=>{
    const f=e.target.files[0];if(!f)return;
    setUploading(true);setUploadMsg('');
    const fd=new FormData();fd.append('file',f);
    const r=await upl('/admin/upload-prices',fd);
    setUploading(false);
    setUploadMsg(r?`Added ${r.rows_added} price records. Predictions will now use real data.`:'Upload failed.');
    e.target.value='';
  };
  const handleRetrain=async()=>{
    setRetraining(true);setRetrainError('');setRetrainResult(null);
    try{
      const tok=localStorage.getItem('sp_token');
      const r=await fetch(API_BASE+'/admin/retrain',{method:'POST',headers:{'Authorization':`Bearer ${tok}`}});

      const d=await r.json();
      if(!r.ok){setRetrainError(d.detail||'Retraining failed');}
      else{setRetrainResult(d);}
    }catch{setRetrainError('Network error - retraining failed');}
    setRetraining(false);
  };

  if(!user||user.role!=='admin')return <main style={{textAlign:'center',padding:'80px 0'}}><h2>Access Restricted</h2></main>;

  const TABS=[['overview','Overview'],['users','Users'],['products','Products'],['pending','Pending Approvals'],['data','Data Upload'],['prices','Market Prices']];
  const[priceMarket,setPriceMarket]=useState('Kimironko');
  const[mktPrices,setMktPrices]=useState([]);
  useEffect(()=>{
    if(tab!=='prices'||!user||user.role!=='admin')return;
    Promise.all(COMMODITIES.map(async c=>{
      const d=await post('/predict',{commodity:c,market:priceMarket,forecast_date:nextWeek()});
      return d?{commodity:c,price:d.predicted_price_kes,trend:d.trend,source:d.data_source}:{commodity:c,price:0,trend:'stable',source:'proxy'};
    })).then(setMktPrices);
  },[tab,priceMarket]);

  return(
    <main>
      <section style={{padding:'32px 0 24px'}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 2px'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'flex-start'}}>
            <h1 style={{margin:0,textAlign:'left'}}>Platform <span style={{color:'#087a3a'}}>Control Centre</span></h1>
          </div>

          <div style={{marginTop:14,display:'flex',alignItems:'center',justifyContent:'flex-start'}}>
            <div className="admin-tabs" style={{display:'flex',gap:10,flexWrap:'wrap',overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
              {TABS.map(([t,l])=>(
                <button
                  key={t}
                  onClick={()=>setTab(t)}
                  style={{
                    padding:'10px 18px',
                    borderRadius:12,
                    border:'1px solid',
                    borderColor:tab===t?'#087a3a':'#e5e9ef',
                    background:tab===t?'#087a3a':'white',
                    color:tab===t?'white':'#344054',
                    fontWeight:700,
                    cursor:'pointer',
                    fontSize:13,
                    whiteSpace:'nowrap'
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {tab==='overview'&&stats&&(
        <>
          <div className="admin-grid" style={{marginBottom:24,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:16}}>
            <Stat icon={<Users size={18}/>} label="Users" value={stats.total_users} color="#087a3a"/>
            <Stat icon={<Store size={18}/>} label="Sellers" value={stats.total_sellers} color="#ff6b00"/>
            <Stat icon={<ShoppingBasket size={18}/>} label="Products" value={stats.total_products} color="#845ec2"/>
            <Stat icon={<LineChart size={18}/>} label="Forecasts" value={stats.total_forecasts} color="#3498db"/>
            <Stat icon={<CheckCircle size={18}/>} label="Price Records" value={stats.total_price_records} color="#087a3a"/>
          </div>
          <div className="grid2" style={{gap:20}}>
            <Card>
              <h3 style={{marginTop:0}}>Recent Forecast Requests</h3>
              <table>
                <tbody>
                  <tr><th>Commodity</th><th>Market</th><th>Price</th><th>Time</th></tr>
                  {stats.recent_forecasts?.map((f,i)=>(
                    <tr key={i}><td style={{fontWeight:600}}>{f.commodity}</td><td style={{fontSize:12}}>{f.market}</td><td style={{fontWeight:700}}>{money(f.predicted_rwf)} RWF</td><td style={{fontSize:11,color:'#667085'}}>{new Date(f.created_at).toLocaleTimeString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card>
              <h3 style={{marginTop:0}}>Top Commodities</h3>
              <ResponsiveContainer height={210}>
                <PieChart>
                  <Pie
                    data={stats.top_commodities?.map(c=>({name:c.commodity,value:c.requests}))}
                    dataKey="value"
                    outerRadius={78}
                    innerRadius={40}
                  >
                    {stats.top_commodities?.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>

              {stats.top_commodities?.length>0&&(()=>{
                const total = stats.top_commodities.reduce((s,c)=>s+(c.requests||0),0) || 0;
                return(
                  <div style={{marginTop:14}}>
                    <div style={{fontWeight:700,fontSize:12,marginBottom:10,color:'#344054'}}>Legend</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'10px 14px'}}>
                      {stats.top_commodities.map((c,i)=>{
                        const value = c.requests||0;
                        const pct = total ? (value/total)*100 : 0;
                        return(
                          <div key={c.commodity} style={{display:'flex',alignItems:'center',gap:8,minWidth:180}}>
                            <span style={{width:10,height:10,borderRadius:3,background:PALETTE[i%PALETTE.length],flexShrink:0}}/>
                            <div style={{display:'flex',flexDirection:'column',lineHeight:1.1}}>
                              <span style={{fontSize:12,fontWeight:700,color:'#101820'}}>{c.commodity}</span>
                              <span style={{fontSize:12,color:'#667085',fontWeight:600}}>{pct.toFixed(1)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>
        </>
      )}

      {tab==='users'&&(
        <Card>
          <h3 style={{marginTop:0}}>All Users ({users.length})</h3>
          <table>
            <tbody>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Market</th><th>Status</th><th>Action</th></tr>
              {users.map(u=>(
                <tr key={u.id}>
                  <td style={{fontWeight:600}}>{u.name}</td>
                  <td style={{color:'#667085',fontSize:13}}>{u.email}</td>
                  <td><Badge color={u.role==='admin'?'#845ec2':u.role==='seller'?'#ff6b00':'#087a3a'}>{u.role}</Badge></td>
                  <td style={{fontSize:12}}>{u.market||'---'}</td>
                  <td><Badge color={u.active?'#087a3a':'#d92d20'}>{u.active?'Active':'Suspended'}</Badge></td>
                  <td>{u.role!=='admin'&&<button onClick={()=>suspendUser(u.id)} style={{background:u.active?'#fff5f5':'#f4fbf6',border:`1px solid ${u.active?'#fca5a5':'#86efac'}`,borderRadius:8,padding:'5px 10px',cursor:'pointer',color:u.active?'#d92d20':'#087a3a',fontSize:12,fontWeight:600}}>{u.active?'Suspend':'Reactivate'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab==='products'&&(
        <Card>
          <h3 style={{marginTop:0}}>All Seller Products ({products.length})</h3>
          <table>
            <tbody>
              <tr><th>Commodity</th><th>Market</th><th>Price</th><th>Seller</th><th>Status</th></tr>
              {products.map(p=>(
                <tr key={p.id}><td style={{fontWeight:600}}>{p.commodity}</td><td style={{fontSize:12}}>{p.market}</td><td style={{fontWeight:700}}>{money(p.price_rwf)} RWF</td><td>{p.seller_name}</td><td><Badge color={p.status==='active'?'#087a3a':'#667085'}>{p.status}</Badge></td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab==='pending'&&(
        <Card>
          <h3 style={{marginTop:0}}>Pending Price Submissions ({pendingSubs.length})</h3>
          <p style={{fontSize:13,color:'#667085',marginBottom:16}}>Review seller-submitted prices before they feed into the AI model.</p>
          {pendingSubs.length===0?<div style={{textAlign:'center',padding:32,color:'#667085'}}>No pending submissions.</div>:
          <table>
            <tbody>
              <tr><th>Seller</th><th>Commodity</th><th>Market</th><th>Price</th><th>Date</th><th>Submitted</th><th>Actions</th></tr>
              {pendingSubs.map(s=>(
                <tr key={s.id}>
                  <td><div style={{fontWeight:600}}>{s.seller_name}</div><div style={{fontSize:11,color:'#667085'}}>{s.seller_email}</div></td>
                  <td style={{fontWeight:600}}>{s.commodity}</td>
                  <td style={{fontSize:12}}>{s.market}</td>
                  <td style={{fontWeight:700,color:'#087a3a'}}>{money(s.price_rwf)} RWF</td>
                  <td style={{fontSize:12}}>{s.price_date}</td>
                  <td style={{fontSize:11,color:'#667085'}}>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>approveSub(s.id)} style={{background:'#f4fbf6',border:'1px solid #86efac',borderRadius:6,padding:'5px 10px',cursor:'pointer',color:'#087a3a',fontSize:12,fontWeight:600}}>Approve</button>
                      <button onClick={()=>rejectSub(s.id)} style={{background:'#fff5f5',border:'1px solid #fca5a5',borderRadius:6,padding:'5px 10px',cursor:'pointer',color:'#d92d20',fontSize:12,fontWeight:600}}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
        </Card>
      )}

      {tab==='data'&&(
        <div className="rg2" style={{gap:20}}>
          <Card>
            <h3 style={{marginTop:0}}>Upload Real Price Data</h3>
            <p style={{color:'#344054',fontSize:14,lineHeight:1.8}}>Upload a CSV with real Kigali market prices. The model will use this data immediately to improve predictions for all users.</p>
            <div style={{background:'#f4fbf6',border:'2px dashed #c3e6cb',borderRadius:12,padding:24,textAlign:'center',marginBottom:16}}>
              <div style={{fontWeight:600,marginBottom:8,fontSize:14}}>CSV Format</div>
              <code style={{fontSize:12,color:'#667085',display:'block',background:'#e8f5ec',padding:'8px 12px',borderRadius:6,lineHeight:2.2,textAlign:'left'}}>
                commodity,market,price_rwf,price_date<br/>
                Maize,Kimironko,520,2026-07-01<br/>
                Beans (Dry),Nyabugogo,1200,2026-07-01<br/>
                Rice,Kicukiro,10000,2026-07-01
              </code>
            </div>
            {uploadMsg&&<div style={{background:'#f4fbf6',border:'1px solid #86efac',borderRadius:8,padding:12,marginBottom:12,fontSize:13,color:'#087a3a'}}>{uploadMsg}</div>}
            <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} style={{display:'none'}}/>
            <button className="orange" style={{width:'100%',padding:'14px 0',borderRadius:10}} onClick={()=>fileRef.current.click()} disabled={uploading}><Upload size={16}/> {uploading?'Uploading...':'Upload CSV'}</button>
          </Card>
          <Card>
            <h3 style={{marginTop:0}}>Model Retraining</h3>

            {/* Current model metrics */}
            <div style={{background:'#f8f9fa',borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#667085',marginBottom:10}}>Current Model Performance</div>
              <div className="rg3" style={{gap:10}}>
                {[['MAPE',retrainResult?retrainResult.mape_percent+'%':'8.27%'],['R² Score',retrainResult?retrainResult.r2_score:'0.9845'],['Samples',retrainResult?retrainResult.samples_used+retrainResult.test_samples:'---']].map(([k,v])=>(
                  <div key={k} style={{textAlign:'center',padding:'10px 8px',background:'white',borderRadius:8,border:'1px solid #e5e9ef'}}>
                    <div style={{fontWeight:800,fontSize:18,color:'#087a3a'}}>{v}</div>
                    <div style={{fontSize:11,color:'#667085',marginTop:2}}>{k}</div>
                  </div>
                ))}
              </div>
              {retrainResult&&(
                <div style={{marginTop:10,fontSize:12,color:'#667085'}}>
                  RMSE: {retrainResult.rmse_rwf} RWF &nbsp;|&nbsp;
                  Records: {retrainResult.total_price_records} &nbsp;|&nbsp;
                  Pairs: {retrainResult.commodity_market_pairs}
                </div>
              )}
            </div>

            {/* Retrain error */}
            {retrainError&&<div style={{background:'#fff5f5',border:'1px solid #fca5a5',borderRadius:8,padding:12,marginBottom:12,fontSize:13,color:'#d92d20'}}>{retrainError}</div>}

            {/* Retrain success */}
            {retrainResult&&(
              <div style={{background:'#f4fbf6',border:'2px solid #86efac',borderRadius:12,padding:16,marginBottom:12}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <CheckCircle size={18} color="#087a3a"/>
                  <span style={{fontWeight:700,color:'#087a3a',fontSize:15}}>Model Retrained Successfully!</span>
                </div>
                <div className="rg2" style={{gap:8,fontSize:13}}>
                  <div>MAPE: <b>{retrainResult.mape_percent}%</b></div>
                  <div>R²: <b>{retrainResult.r2_score}</b></div>
                  <div>RMSE: <b>{retrainResult.rmse_rwf} RWF</b></div>
                  <div>Training Samples: <b>{retrainResult.samples_used}</b></div>
                  <div>Test Samples: <b>{retrainResult.test_samples}</b></div>
                  <div>Total Records: <b>{retrainResult.total_price_records}</b></div>
                </div>
              </div>
            )}

            <button className="primary" style={{width:'100%',padding:'14px 0',borderRadius:10}} onClick={handleRetrain} disabled={retraining}>
              <LineChart size={16}/> {retraining?'Retraining Model...':'Retrain Model on Uploaded Data'}
            </button>
            <p style={{fontSize:11,color:'#667085',marginTop:8,textAlign:'center'}}>Requires 30+ price records across multiple dates</p>
          </Card>
        </div>
      )}
      {tab==='prices'&&(
        <div>
          <div style={{marginBottom:16,maxWidth:280}}>
            <Sel label="Select Market" value={priceMarket} onChange={v=>{setPriceMarket(v);}} items={MARKETS}/>
          </div>
          <Card>
            <h3 style={{marginTop:0}}>AI Predicted Prices at {priceMarket}</h3>
            {mktPrices.length===0?<Spinner/>:(
              <table>
                <tbody>
                  <tr><th>Commodity</th><th>Predicted Price (RWF/kg)</th><th>Trend</th><th>Data Source</th></tr>
                  {mktPrices.map(p=>(
                    <tr key={p.commodity}>
                      <td style={{fontWeight:600}}>{p.commodity}</td>
                      <td style={{fontWeight:700,color:p.price>0?'#087a3a':'#d92d20'}}>{p.price>0?money(p.price)+' RWF':'No data'}</td>
                      <td><TrendBadge trend={p.trend}/></td>
                      <td><Badge color={p.source==='real_prices'?'#087a3a':'#667085'}>{p.source==='real_prices'?'Real Data':'Proxy'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}

// Chat Widget — realtime-style messenger UI with WhatsApp-like design
const fmtChatTime=ts=>{const d=new Date(ts);const now=new Date();const isToday=d.toDateString()===now.toDateString();const yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);const isYesterday=d.toDateString()===yesterday.toDateString();if(isToday)return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(isYesterday)return 'Yesterday';return d.toLocaleDateString([],{month:'short',day:'numeric'});};
const fmtMsgTime=ts=>new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const needsDateSep=(msgs,i)=>{if(i===0)return true;const cur=new Date(msgs[i].created_at).toDateString();const prev=new Date(msgs[i-1].created_at).toDateString();return cur!==prev;};
const dateSepLabel=ts=>{const d=new Date(ts);const now=new Date();if(d.toDateString()===now.toDateString())return 'Today';const y=new Date(now);y.setDate(y.getDate()-1);if(d.toDateString()===y.toDateString())return 'Yesterday';return d.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});};

function ChatWidget(){
  const{user}=useAuth();const{get,post}=useApi();
  const[open,setOpen]=useState(false);
  const[view,setView]=useState('conversations');
  const[convs,setConvs]=useState([]);
  const[messages,setMessages]=useState([]);
  const[partner,setPartner]=useState(null);
  const[text,setText]=useState('');
  const[sending,setSending]=useState(false);
  const[sendErr,setSendErr]=useState('');
  const[unreadTotal,setUnreadTotal]=useState(0);
  const chatRef=useRef(null);
  const inputRef=useRef(null);
  const pollRef=useRef(null);

  const loadConversations=async()=>{
    const d=await get('/messages/conversations');
    if(d){setConvs(d.conversations||[]);setUnreadTotal(d.conversations?.reduce((s,c)=>s+(c.unread||0),0)||0);}
  };

  const loadUnread=async()=>{
    const tok=localStorage.getItem('sp_token');
    if(!tok)return;
    const d=await get('/messages/unread-count');
    if(d)setUnreadTotal(d.count||0);
  };

  const openChat=async(p)=>{
  setView('chat');setSendErr('');
  const d=await get('/messages/'+p.partner_id);
  if(d&&d.messages&&d.messages.length>0){
    setMessages(d.messages);
    const otherMsg=d.messages.find(m=>m.sender_id!==user.id);
    if(otherMsg){
      setPartner({
        partner_id:otherMsg.sender_id,
        partner_name:otherMsg.sender_name,
        partner_role:p.partner_role
      });
    }else{
      setPartner(p);
    }
  }else{
    setMessages([]);
    setPartner(p);
  }
  setTimeout(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},100);
};

  const sendMessage=async()=>{
    if(!text.trim()||!partner||!partner.partner_id)return;
    setSending(true);setSendErr('');
    const token=localStorage.getItem('sp_token');
    try{
      const res=await fetch(API_BASE+'/messages/send',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({receiver_id:partner.partner_id,message:text.trim()})});
      const data=await res.json();
      if(!res.ok){setSendErr('Failed: '+(data.detail||res.status));}
      else{setMessages(m=>[...m,{...data,sender_name:user.name}]);setText('');inputRef.current?.focus();}
    }catch(e){setSendErr('Network error');}
    setSending(false);
  };

  const backToConvs=()=>{setView('conversations');setPartner(null);setMessages([]);loadConversations();};

  // External chat triggers from Markets page
  useEffect(()=>{
    const check=()=>{const raw=sessionStorage.getItem('sp_chat_target');if(!raw)return;sessionStorage.removeItem('sp_chat_target');try{const p=JSON.parse(raw);setOpen(true);setPartner(p);setView('chat');get('/messages/'+p.partner_id).then(d=>{if(d)setMessages(d.messages||[]);});}catch{}};const iv=setInterval(check,400);return ()=>clearInterval(iv);},[]);

  // Conversations polling while open
  useEffect(()=>{if(open&&user){loadConversations();const iv=setInterval(loadConversations,3000);return ()=>clearInterval(iv);}},[open,user]);

  // Unread count polling only when authenticated (token must exist)
  useEffect(()=>{
    const tok=localStorage.getItem('sp_token');
    if(!user||!tok)return;
    loadUnread();
    const iv=setInterval(loadUnread,5000);
    return ()=>clearInterval(iv);
  },[user,loadUnread]);

  // Message polling: 1.5s when in chat view
  useEffect(()=>{
    if(view!=='chat'||!partner)return;
    let active=true;
    const poll=async()=>{const d=await get('/messages/'+partner.partner_id);if(active&&d&&d.messages&&d.messages.length>0)setMessages(d.messages);};
    poll();const iv=setInterval(poll,1500);
    return ()=>{active=false;clearInterval(iv);};
  },[view,partner]);

  // Auto-scroll
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[messages]);

  if(!user)return null;
  if(user.role==='admin')return null;

  return(
    <>
      {/* Floating chat button */}
      <button className="chat-btn" onClick={()=>{setOpen(!open);if(!open){loadConversations();loadUnread();}}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        {open?<span style={{fontSize:24,lineHeight:1}}>×</span>:<><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></>}
        {!open&&unreadTotal>0&&<span style={{position:'absolute',top:-6,right:-6,background:'#ff3b30',color:'white',borderRadius:'50%',minWidth:23,height:23,fontSize:11,fontWeight:800,display:'grid',placeItems:'center',border:'2px solid white',padding:'0 5px'}}>{unreadTotal>99?'99+':unreadTotal}</span>}
      </button>

      {/* Chat panel */}
      {open&&(
        <div style={{position:'fixed',right:'1rem',bottom:'5rem',zIndex:999,width:'calc(100vw - 2rem)',maxWidth:'390px',maxHeight:'70vh',background:'white',borderRadius:20,boxShadow:'0 20px 60px rgba(0,0,0,.2)',border:'1px solid #e5e9ef',display:'flex',flexDirection:'column',overflow:'hidden',animation:'chatIn .25s ease'}}>
          <style>{`@keyframes chatIn{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'#087a3a',color:'white'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {view==='chat'&&<button onClick={backToConvs} style={{background:'rgba(255,255,255,.15)',border:'none',color:'white',borderRadius:'50%',width:32,height:32,display:'grid',placeItems:'center',cursor:'pointer',fontSize:16}}>←</button>}
              {view==='chat'&&partner?(
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,.2)',display:'grid',placeItems:'center',color:'white',fontSize:15,fontWeight:700}}>{partner.partner_name?.[0]?.toUpperCase()||'?'}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,lineHeight:1.1}}>{partner.partner_name||'Chat'}</div>
                    <div style={{fontSize:10,opacity:.7}}>Online</div>
                  </div>
                </div>
              ):(
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,.2)',display:'grid',placeItems:'center',fontSize:16}}>💬</div>
                  <div style={{fontWeight:700,fontSize:15}}>Messages</div>
                </div>
              )}
            </div>
            <button onClick={()=>setOpen(false)} style={{background:'rgba(255,255,255,.15)',border:'none',color:'white',borderRadius:'50%',width:32,height:32,display:'grid',placeItems:'center',cursor:'pointer',fontSize:18,fontWeight:300}}>×</button>
          </div>

          {/* Conversations list */}
          {view==='conversations'&&(
            <div style={{overflow:'auto',flex:1,background:'#fafafa'}}>
              {convs.length===0?(
                <div style={{textAlign:'center',padding:48,color:'#999'}}>
                  <div style={{fontSize:48,marginBottom:12}}>💬</div>
                  <div style={{fontWeight:600,fontSize:14,color:'#555',marginBottom:6}}>No messages yet</div>
                  <div style={{fontSize:12}}>Browse products and click "Chat" to start a conversation</div>
                </div>
              ):convs.map(c=>(
                <div key={c.partner_id} onClick={()=>openChat(c)}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer',borderBottom:'1px solid #f0f0f0',transition:'background .15s',background:'white'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#f4fbf6'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}>
                  <div style={{position:'relative',flexShrink:0}}>
                    <div style={{width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#087a3a,#0aab50)',display:'grid',placeItems:'center',color:'white',fontSize:17,fontWeight:700}}>{c.partner_name?.[0]?.toUpperCase()||'?'}</div>
                    <div style={{position:'absolute',bottom:1,right:1,width:12,height:12,borderRadius:'50%',background:'#4caf50',border:'2px solid white'}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                      <span style={{fontWeight:700,fontSize:13.5,color:'#101820'}}>{c.partner_name}</span>
                      <span style={{fontSize:10.5,color:'#999',flexShrink:0,marginLeft:8}}>{fmtChatTime(c.last_time)}</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:3}}>
                      <span style={{fontSize:12.5,color:'#888',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{c.last_message||'Start a conversation'}</span>
                      {c.unread>0&&<span style={{background:'#087a3a',color:'white',borderRadius:'50%',minWidth:20,height:20,fontSize:10.5,fontWeight:700,display:'grid',placeItems:'center',flexShrink:0,marginLeft:6,padding:'0 4px'}}>{c.unread}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chat view */}
          {view==='chat'&&partner&&(
            <>
              <div ref={chatRef} style={{flex:1,overflow:'auto',padding:'12px 14px',background:'#e8eef5',backgroundImage:'linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px)',backgroundSize:'100% 24px',display:'flex',flexDirection:'column',gap:3}}>
                {messages.length===0&&(
                  <div style={{textAlign:'center',padding:40,color:'#999',fontSize:13}}>
                    <div style={{fontSize:36,marginBottom:8}}>👋</div>
                    <div>No messages yet. Say hello!</div>
                  </div>
                )}
                {messages.map((m,i)=>{
                  const isMine=m.sender_id===user.id;
                  const showDateSep=needsDateSep(messages,i);
                  return(
                    <React.Fragment key={m.id||i}>
                      {showDateSep&&(
                        <div style={{display:'flex',justifyContent:'center',margin:'12px 0 8px'}}>
                          <span style={{background:'rgba(255,255,255,.85)',color:'#666',fontSize:11,fontWeight:600,padding:'4px 14px',borderRadius:20,boxShadow:'0 1px 3px rgba(0,0,0,.08)'}}>{dateSepLabel(m.created_at)}</span>
                        </div>
                      )}
                      <div style={{display:'flex',flexDirection:'column',alignItems:isMine?'flex-end':'flex-start',marginBottom:2}}>
                        {!isMine&&<span style={{fontSize:10,fontWeight:700,color:'#555',marginLeft:12,marginBottom:1}}>{m.sender_name||'User'}</span>}
                        <div style={{maxWidth:'82%',padding:'8px 13px',borderRadius:16,borderTopRightRadius:isMine?4:16,borderTopLeftRadius:isMine?16:4,background:isMine?'#d1f0d9':'white',color:'#101820',boxShadow:'0 1px 2px rgba(0,0,0,.06)',position:'relative'}}>
                          <div style={{fontSize:13.5,lineHeight:1.45,wordBreak:'break-word'}}>{m.message}</div>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4,marginTop:3}}>
                            <span style={{fontSize:10,color:'#888'}}>{fmtMsgTime(m.created_at)}</span>
                            {isMine&&<span style={{color:'#34b759',fontSize:11}}>✓</span>}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              {sendErr&&<div style={{padding:'8px 14px',background:'#fff5f5',borderTop:'1px solid #fca5a5',color:'#d92d20',fontSize:11.5,textAlign:'center',animation:'chatIn .2s ease'}}>⚠ {sendErr}</div>}
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderTop:'1px solid #e5e9ef',background:'white'}}>
                <input ref={inputRef} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                  placeholder="Type a message..." style={{flex:1,border:'1.5px solid #e0e0e0',borderRadius:24,padding:'10px 16px',fontSize:13.5,outline:'none',background:'#f5f5f5',transition:'border-color .2s'}}
                  onFocus={e=>{e.target.style.borderColor='#087a3a';e.target.style.background='white';}}
                  onBlur={e=>{e.target.style.borderColor='#e0e0e0';e.target.style.background='#f5f5f5';}}
                  disabled={sending}/>
                <button onClick={sendMessage} disabled={sending||!text.trim()}
                  style={{width:40,height:40,borderRadius:'50%',background:sending||!text.trim()?'#ccc':'#087a3a',color:'white',border:'none',display:'grid',placeItems:'center',cursor:sending||!text.trim()?'default':'pointer',transition:'all .2s',flexShrink:0}}>
                  {sending?<span style={{fontSize:14}}>⏳</span>:<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

// App
function App(){
  const[page,setPage]=useState('Home');
  const[sharedBasket,setSharedBasket]=useState([]);
  const[autoLogging,setAutoLogging]=useState(false);
  const[autoLoginFailed,setAutoLoginFailed]=useState(false);
  const[user,setUser]=useState(()=>{
    // Restore user from localStorage if token is still valid
    const stored=localStorage.getItem('sp_user');
    const t=localStorage.getItem('sp_token');
    if(!stored||!t)return null;
    try{
      const p=JSON.parse(atob(t.split('.')[0]));
      if(p.exp<Date.now()/1000)return null; // expired → will auto-login
      return JSON.parse(stored);
    }catch{return null;}
  });

  // Show spinner during initial render if we have saved creds but no valid user (prevents flash of login page)
  const needsAutoLogin = !user && !autoLoginFailed && !!localStorage.getItem('sp_creds');
  const showSpinner = autoLogging || needsAutoLogin;

  // Auto-login with saved credentials when token is expired or missing
  useEffect(()=>{
    if(user)return;                                    // already logged in
    if(autoLogging)return;                             // already trying
    const creds=localStorage.getItem('sp_creds');
    if(!creds)return;                                  // no saved credentials
    try{
      const dec=atob(creds);
      const idx=dec.indexOf(':');
      if(idx===-1)return;
      const email=dec.slice(0,idx),pw=dec.slice(idx+1);
      setAutoLogging(true);
      fetch(API_BASE+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})})
        .then(r=>r.json()).then(r=>{
          if(!r.token){setAutoLogging(false);setAutoLoginFailed(true);return;}
          localStorage.setItem('sp_token',r.token);
          localStorage.setItem('sp_user',JSON.stringify(r.user));
          setUser(r.user);
          setAutoLogging(false);
        }).catch(()=>{setAutoLogging(false);setAutoLoginFailed(true);});
    }catch{setAutoLogging(false);setAutoLoginFailed(true);}
  },[user,autoLogging]);

  const logout=()=>{localStorage.removeItem('sp_token');localStorage.removeItem('sp_user');localStorage.removeItem('sp_creds');setUser(null);setIsAdmin(false);setAutoLoginFailed(false);location.hash='';setPage('Home');};

  // Admin only via hash, never shown in nav
  const[isAdmin,setIsAdmin]=useState(()=>{
    // Compute immediately on mount so refresh at #admin doesn't flash Home
    if(location.hash!=='#admin')return false;
    const stored=localStorage.getItem('sp_user');
    const t=localStorage.getItem('sp_token');
    if(!stored||!t)return false;
    try{
      const p=JSON.parse(atob(t.split('.')[0]));
      if(p.exp<Date.now()/1000)return false;
      const u=JSON.parse(stored);
      return u.role==='admin';
    }catch{return false;}
  });
  useEffect(()=>{
    const check=()=>setIsAdmin(location.hash==='#admin'&&user?.role==='admin');
    check();addEventListener('hashchange',check);return()=>removeEventListener('hashchange',check);
  },[user]);

  // Derived synchronously every render so #admin never flashes the wrong page,
  // even when isAdmin state hasn't caught up (e.g. right after auto-login completes).
  const isAdminEffective = isAdmin || (location.hash === '#admin' && user?.role === 'admin');

  const PAGES={Home,Pricing,Markets,'Cost Estimator':CostEstimator,Sellers,Alerts,About,Login,Register};

  const renderPage=()=>{
    if(isAdminEffective)return <Admin/>;
    const P=PAGES[page]||Home;
    if(page==='Markets')return <P basketItems={sharedBasket} setPage={setPage}/>;
    if(page==='Cost Estimator')return <P setPage={setPage} setSharedBasket={setSharedBasket}/>;
    return <P setPage={setPage}/>;
  };

  return(
    <AuthCtx.Provider value={{user,setUser,logout}}>
      {showSpinner?<div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f4fbf6'}}><Spinner/></div>:
      <Layout page={isAdminEffective?'Admin':page} setPage={p=>{location.hash=p==='Admin'?'#admin':'';setPage(p);}}>
        {renderPage()}
        <ChatWidget/>
      </Layout>}
    </AuthCtx.Provider>
  );
}

createRoot(document.getElementById('root')).render(<App/>);
