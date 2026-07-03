import React, {useEffect, useRef, useState, useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Bell, CheckCircle, ChevronRight, Edit2, Eye, EyeOff,
  LineChart, LogIn, LogOut, MapPin, Pencil, Plus,
  Shield, ShoppingBasket, Store, Trash2, TrendingDown,
  TrendingUp, Upload, User, Users, Wallet, Zap
} from 'lucide-react';
import {
  Bar, BarChart, Cell, Line, LineChart as RLineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import './styles.css';

// ── Config ─────────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const MARKETS = ['Kimironko','Nyabugogo','Kicukiro','Kimisagara','Kigali City Market'];
const COMMODITIES = [
  'Maize','Maize Flour','Potatoes','Rice',
  'Beans (Dry)','Sorghum','Bananas','Spinach','Cabbage','Flour'
];

const MARKET_COORDS = {
  'Kimironko'         :{lat:-1.9441,lon:30.1074},
  'Nyabugogo'         :{lat:-1.9359,lon:30.0547},
  'Kicukiro'          :{lat:-1.9706,lon:30.0878},
  'Kimisagara'        :{lat:-1.9592,lon:30.0442},
  'Kigali City Market':{lat:-1.9500,lon:30.0619},
};

const MARKET_IMAGES = {
  'Kimironko'         :'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400&q=80',
  'Nyabugogo'         :'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Kicukiro'          :'https://images.unsplash.com/photo-1611689342806-0863700ce1e4?w=400&q=80',
  'Kimisagara'        :'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=400&q=80',
  'Kigali City Market':'https://images.unsplash.com/photo-1571757767119-68b8dbed8c97?w=400&q=80',
};

const EMOJI = {
  'Maize':'🌽','Maize Flour':'🌾','Potatoes':'🥔','Rice':'🍚',
  'Beans (Dry)':'🫘','Sorghum':'🌾','Bananas':'🍌',
  'Spinach':'🥬','Cabbage':'🥦','Flour':'🌾'
};

const PALETTE = ['#087a3a','#ff6b00','#d7b84a','#845ec2','#6c9a36','#e74c3c','#3498db'];

// ── Helpers ─────────────────────────────────────────────────────────────────
const money = n => Math.round(n||0).toLocaleString();
const nextWeek = () => new Date(Date.now()+7*24*60*60*1000).toISOString().split('T')[0];

function haversine(lat1,lon1,lat2,lon2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(1);
}

function distanceTo(market,userLoc){
  if(!userLoc||!MARKET_COORDS[market])return null;
  return haversine(userLoc.lat,userLoc.lon,MARKET_COORDS[market].lat,MARKET_COORDS[market].lon);
}

// ── API client ───────────────────────────────────────────────────────────────
function useApi(){
  const token = () => localStorage.getItem('sp_token');
  const headers = () => ({'Content-Type':'application/json','Authorization':`Bearer ${token()}`});

  const post = async(path,body)=>{
    try{
      const r=await fetch(API+path,{method:'POST',headers:headers(),body:JSON.stringify(body)});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||'Error');
      return d;
    }catch{return null;}
  };

  const get = async(path)=>{
    try{
      const r=await fetch(API+path,{headers:headers()});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||'Error');
      return d;
    }catch{return null;}
  };

  const put = async(path,body)=>{
    try{
      const r=await fetch(API+path,{method:'PUT',headers:headers(),body:JSON.stringify(body)});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||'Error');
      return d;
    }catch{return null;}
  };

  const del = async(path)=>{
    try{
      const r=await fetch(API+path,{method:'DELETE',headers:{'Authorization':`Bearer ${token()}`}});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||'Error');
      return d;
    }catch{return null;}
  };

  const upload = async(path,formData)=>{
    try{
      const r=await fetch(API+path,{method:'POST',headers:{'Authorization':`Bearer ${token()}`},body:formData});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||'Error');
      return d;
    }catch{return null;}
  };

  return{post,get,put,del,upload};
}

// ── GPS hook ─────────────────────────────────────────────────────────────────
function useLocation(){
  const[loc,setLoc]=useState(null);
  useEffect(()=>{
    if(!navigator.geolocation)return;
    navigator.geolocation.getCurrentPosition(
      p=>setLoc({lat:p.coords.latitude,lon:p.coords.longitude}),
      ()=>setLoc(null)
    );
  },[]);
  return loc;
}

// ── Auth context ─────────────────────────────────────────────────────────────
const AuthCtx = React.createContext(null);
const useAuth = () => React.useContext(AuthCtx);

// ── Leaflet Map ──────────────────────────────────────────────────────────────
function LeafletMap({userLoc,selectedMarket,onSelectMarket}){
  const ref=useRef(null);
  const mapRef=useRef(null);

  useEffect(()=>{
    if(mapRef.current||!ref.current)return;

    function initMap(){
      const L=window.L;
      const center=userLoc?[userLoc.lat,userLoc.lon]:[-1.9500,30.0588];
      const map=L.map(ref.current,{zoomControl:true}).setView(center,13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        attribution:'© OpenStreetMap contributors'
      }).addTo(map);

      if(userLoc){
        const userIcon=L.divIcon({
          html:'<div style="background:#087a3a;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
          iconSize:[18,18],iconAnchor:[9,9],className:''
        });
        L.marker([userLoc.lat,userLoc.lon],{icon:userIcon})
          .addTo(map).bindPopup('<b>📍 Your Location</b>');
      }

      Object.entries(MARKET_COORDS).forEach(([name,c])=>{
        const isSelected=name===selectedMarket;
        const icon=L.divIcon({
          html:`<div style="background:${isSelected?'#ff6b00':'#087a3a'};color:white;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,0.3);border:2px solid white;cursor:pointer">${name}</div>`,
          iconAnchor:[0,10],className:''
        });
        L.marker([c.lat,c.lon],{icon})
          .addTo(map)
          .bindPopup(`<b>${name}</b><br/><small>Click to select this market</small>`)
          .on('click',()=>onSelectMarket&&onSelectMarket(name));
      });

      mapRef.current=map;
    }

    if(window.L){
      initMap();
    } else {
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script=document.createElement('script');
      script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload=initMap;
      document.head.appendChild(script);
    }
  },[]);

  return <div ref={ref} style={{height:340,borderRadius:14,overflow:'hidden',zIndex:1}}/>;
}

// ── Shared UI ────────────────────────────────────────────────────────────────
function Card({children,style,className=''}){
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

function Stat({icon,label,value,sub,color='#087a3a'}){
  return(
    <Card style={{display:'flex',alignItems:'center',gap:16,padding:'16px 20px'}}>
      <div style={{width:48,height:48,borderRadius:12,background:`${color}15`,display:'grid',
        placeItems:'center',color,flexShrink:0}}>{icon}</div>
      <div>
        <div style={{fontSize:11,color:'#667085',fontWeight:600,textTransform:'uppercase',letterSpacing:.5}}>{label}</div>
        <div style={{fontSize:20,fontWeight:700,color:'#101820',lineHeight:1.2}}>{value}</div>
        {sub&&<div style={{fontSize:12,color:'#667085',marginTop:2}}>{sub}</div>}
      </div>
    </Card>
  );
}

function Sel({label,value,onChange,items,style}){
  return(
    <label className="select" style={style}>
      {label&&<span>{label}</span>}
      <select value={value} onChange={e=>onChange(e.target.value)}>
        {items.map(i=><option key={i}>{i}</option>)}
      </select>
    </label>
  );
}

function Inp({label,type='text',value,onChange,placeholder,style}){
  return(
    <label className="select" style={style}>
      {label&&<span>{label}</span>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
    </label>
  );
}

function Badge({children,color='#087a3a'}){
  return(
    <span style={{background:`${color}18`,color,padding:'3px 10px',
      borderRadius:20,fontSize:12,fontWeight:700,display:'inline-block'}}>{children}</span>
  );
}

function TrendBadge({trend}){
  const cfg={
    rising: {color:'#d92d20',icon:<TrendingUp size={12}/>,label:'Rising'},
    falling:{color:'#087a3a',icon:<TrendingDown size={12}/>,label:'Falling'},
    stable: {color:'#667085',icon:null,label:'Stable'},
  }[trend]||{color:'#667085',icon:null,label:'Stable'};
  return(
    <span style={{display:'inline-flex',alignItems:'center',gap:4,
      color:cfg.color,fontSize:13,fontWeight:700}}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function Spinner(){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:48}}>
      <div style={{width:36,height:36,border:'3px solid #e5e9ef',
        borderTopColor:'#087a3a',borderRadius:'50%',animation:'sp 1s linear infinite'}}/>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ProduceHero(){
  return(
    <div style={{borderRadius:16,overflow:'hidden',position:'relative',minHeight:280,
      background:'linear-gradient(135deg,#0a5c2b,#0d8a3e)'}}>
      <div style={{position:'absolute',inset:0,
        background:'url(https://images.unsplash.com/photo-1542838132-92c53300491e?w=700&q=80) center/cover',
        opacity:.22}}/>
      <div style={{position:'absolute',bottom:24,left:24}}>
        <div style={{fontSize:56}}>🛒</div>
        <div style={{color:'white',fontWeight:800,fontSize:20,marginTop:8}}>Kigali Markets</div>
        <div style={{color:'rgba(255,255,255,.65)',fontSize:13,marginTop:4}}>AI-powered price forecasts</div>
      </div>
    </div>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────
function Layout({page,setPage,children}){
  const {user,logout}=useAuth();
  const nav=['Home','Pricing','Markets','Cost Estimator','Sellers','Alerts','About'];

  return(
    <>
      <div className="top" style={{backdropFilter:'blur(12px)',background:'rgba(255,255,255,.96)',
        boxShadow:'0 1px 0 #e5e9ef'}}>
        <div className="brand" style={{cursor:'pointer',userSelect:'none'}} onClick={()=>setPage('Home')}>
          <span style={{fontSize:28}}>🛒</span>
          <span style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',
            WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',fontWeight:800,fontSize:24}}>
            SokoPrice
          </span>
        </div>

        <nav>
          {nav.map(n=>(
            <button key={n} className={page===n?'active':''} onClick={()=>setPage(n)}
              style={{fontSize:13.5,letterSpacing:.15,transition:'color .15s'}}>
              {n}
            </button>
          ))}
        </nav>

        <div className="right" style={{gap:10}}>
          {user?(
            <>
              <div onClick={()=>setPage(user.role==='admin'?'Admin':user.role==='seller'?'Sellers':'Home')}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',
                  background:'#f4fbf6',borderRadius:12,cursor:'pointer',border:'1px solid #c3e6cb'}}>
                <div style={{width:32,height:32,borderRadius:'50%',
                  background:'linear-gradient(135deg,#087a3a,#0aab50)',
                  display:'grid',placeItems:'center',color:'white',fontSize:14,fontWeight:700}}>
                  {user.name[0].toUpperCase()}
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,lineHeight:1}}>{user.name}</div>
                  <div style={{fontSize:11,color:'#667085',textTransform:'capitalize'}}>{user.role}</div>
                </div>
              </div>
              <button className="ghost" onClick={logout} style={{padding:'10px 14px'}}>
                <LogOut size={15}/>
              </button>
            </>
          ):(
            <>
              <button className="ghost" onClick={()=>setPage('Login')} style={{padding:'10px 20px',fontSize:13.5}}>
                <LogIn size={15}/> Sign In
              </button>
              <button className="primary" onClick={()=>setPage('Register')} style={{padding:'10px 20px',fontSize:13.5}}>
                <User size={15}/> Get Started
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{minHeight:'calc(100vh - 70px)'}}>{children}</div>

      <footer style={{background:'linear-gradient(135deg,#0a3d1f,#0d5c2e)',color:'white',padding:'48px 9% 28px'}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr repeat(3,1fr) 1.5fr',gap:32,maxWidth:1200,margin:'auto'}}>
          <div>
            <div style={{fontSize:22,fontWeight:800,marginBottom:12}}>🛒 SokoPrice</div>
            <p style={{color:'rgba(255,255,255,.6)',fontSize:13.5,lineHeight:1.8}}>
              AI-powered grocery price forecasting for Kigali's informal markets.
              Helping consumers shop smarter every day.
            </p>
          </div>
          {[['Product',['Pricing','Markets','Alerts','Cost Estimator']],
            ['Company',['About','Careers','Blog']],
            ['Support',['Help Center','Contact Us','Privacy']],
          ].map(([title,links])=>(
            <div key={title}>
              <div style={{fontWeight:700,marginBottom:14,fontSize:13.5}}>{title}</div>
              {links.map(l=>(
                <div key={l} style={{color:'rgba(255,255,255,.55)',fontSize:13,
                  marginBottom:9,cursor:'pointer',transition:'color .15s'}}>{l}</div>
              ))}
            </div>
          ))}
          <div>
            <div style={{fontWeight:700,marginBottom:14,fontSize:13.5}}>Contact</div>
            <div style={{color:'rgba(255,255,255,.55)',fontSize:13,lineHeight:2.2}}>
              📧 n.karabaranga@alustudent.com<br/>
              📍 Kigali, Rwanda<br/>
              🎓 African Leadership University
            </div>
          </div>
        </div>
        <div style={{borderTop:'1px solid rgba(255,255,255,.08)',marginTop:32,paddingTop:20,
          textAlign:'center',color:'rgba(255,255,255,.35)',fontSize:12.5}}>
          © 2026 SokoPrice · BSc Software Engineering Capstone · African Leadership University
        </div>
      </footer>
    </>
  );
}

// ── Login ────────────────────────────────────────────────────────────────────
function Login({setPage}){
  const{post}=useApi();
  const{setUser}=useAuth();
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[showPw,setShowPw]=useState(false);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');

  const submit=async()=>{
    if(!email||!password){setError('Please fill in all fields');return;}
    setLoading(true);setError('');
    const res=await post('/auth/login',{email,password});
    setLoading(false);
    if(!res){setError('Invalid email or password');return;}
    localStorage.setItem('sp_token',res.token);
    setUser(res.user);
    setPage(res.user.role==='admin'?'Admin':res.user.role==='seller'?'Sellers':'Home');
  };

  return(
    <div style={{minHeight:'85vh',display:'grid',placeItems:'center',
      background:'linear-gradient(135deg,#f4fbf6 0%,#e8f5ec 100%)'}}>
      <div style={{width:420,background:'white',borderRadius:24,padding:44,
        boxShadow:'0 24px 64px rgba(0,0,0,0.09)'}}>
        <div style={{textAlign:'center',marginBottom:36}}>
          <div style={{fontSize:52,marginBottom:8}}>🛒</div>
          <h2 style={{margin:0,fontSize:26}}>Welcome back</h2>
          <p style={{color:'#667085',margin:'10px 0 0',fontSize:14}}>Sign in to your SokoPrice account</p>
        </div>

        {error&&(
          <div style={{background:'#fff5f5',border:'1px solid #fca5a5',borderRadius:10,
            padding:12,marginBottom:20,color:'#d92d20',fontSize:13}}>{error}</div>
        )}

        <div style={{display:'grid',gap:16}}>
          <Inp label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com"/>
          <label className="select">
            <span>Password</span>
            <div style={{position:'relative'}}>
              <input type={showPw?'text':'password'} value={password}
                onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
                style={{paddingRight:44}}
                onKeyDown={e=>e.key==='Enter'&&submit()}/>
              <button onClick={()=>setShowPw(!showPw)}
                style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                  background:'none',border:'none',color:'#667085',cursor:'pointer',padding:4}}>
                {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
              </button>
            </div>
          </label>
        </div>

        <button className="primary" style={{width:'100%',marginTop:24,padding:'14px 0',fontSize:15}}
          onClick={submit} disabled={loading}>
          {loading?'Signing in...':'Sign In'}
        </button>

        <div style={{textAlign:'center',marginTop:20,fontSize:14}}>
          <span style={{color:'#667085'}}>Don't have an account? </span>
          <button onClick={()=>setPage('Register')}
            style={{background:'none',border:'none',color:'#087a3a',fontWeight:700,cursor:'pointer',fontSize:14}}>
            Sign Up
          </button>
        </div>

        <div style={{background:'#f4fbf6',borderRadius:10,padding:12,marginTop:20,
          fontSize:12,color:'#667085',lineHeight:1.8}}>
          <b style={{color:'#087a3a'}}>Demo credentials:</b><br/>
          Admin: admin@sokoprice.rw / admin123
        </div>
      </div>
    </div>
  );
}

// ── Register ─────────────────────────────────────────────────────────────────
function Register({setPage}){
  const{post}=useApi();
  const{setUser}=useAuth();
  const[form,setForm]=useState({name:'',email:'',password:'',role:'consumer',market:'Kimironko'});
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const set=k=>v=>setForm(f=>({...f,[k]:v}));

  const submit=async()=>{
    if(!form.name||!form.email||!form.password){setError('Please fill in all fields');return;}
    setLoading(true);setError('');
    const res=await post('/auth/register',form);
    setLoading(false);
    if(!res){setError('Registration failed. Email may already be in use.');return;}
    localStorage.setItem('sp_token',res.token);
    setUser(res.user);
    setPage(res.user.role==='seller'?'Sellers':'Home');
  };

  return(
    <div style={{minHeight:'85vh',display:'grid',placeItems:'center',
      background:'linear-gradient(135deg,#f4fbf6,#e8f5ec)'}}>
      <div style={{width:480,background:'white',borderRadius:24,padding:44,
        boxShadow:'0 24px 64px rgba(0,0,0,0.09)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:52}}>🌱</div>
          <h2 style={{margin:'10px 0 0'}}>Create your account</h2>
          <p style={{color:'#667085',margin:'10px 0 0',fontSize:14}}>Join SokoPrice and shop smarter</p>
        </div>

        {error&&(
          <div style={{background:'#fff5f5',border:'1px solid #fca5a5',borderRadius:10,
            padding:12,marginBottom:16,color:'#d92d20',fontSize:13}}>{error}</div>
        )}

        <div style={{display:'grid',gap:14}}>
          <Inp label="Full name" value={form.name} onChange={set('name')} placeholder="Grace Uwase"/>
          <Inp label="Email"     type="email" value={form.email} onChange={set('email')} placeholder="you@example.com"/>
          <Inp label="Password"  type="password" value={form.password} onChange={set('password')} placeholder="••••••••"/>
          <div>
            <span style={{fontWeight:700,fontSize:13,display:'block',marginBottom:8}}>I am a</span>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {['consumer','seller'].map(r=>(
                <button key={r} onClick={()=>set('role')(r)}
                  style={{padding:'12px 16px',borderRadius:10,
                    border:`2px solid ${form.role===r?'#087a3a':'#e5e9ef'}`,
                    background:form.role===r?'#f4fbf6':'white',
                    color:form.role===r?'#087a3a':'#344054',
                    fontWeight:600,cursor:'pointer',textTransform:'capitalize',fontSize:14,
                    transition:'all .15s'}}>
                  {r==='consumer'?'🛍️ Consumer':'🏪 Seller'}
                </button>
              ))}
            </div>
          </div>
          {form.role==='seller'&&(
            <Sel label="Your market" value={form.market} onChange={set('market')} items={MARKETS}/>
          )}
        </div>

        <button className="primary" style={{width:'100%',marginTop:24,padding:'14px 0',fontSize:15}}
          onClick={submit} disabled={loading}>
          {loading?'Creating account...':'Create Account'}
        </button>

        <div style={{textAlign:'center',marginTop:18,fontSize:14}}>
          <span style={{color:'#667085'}}>Already have an account? </span>
          <button onClick={()=>setPage('Login')}
            style={{background:'none',border:'none',color:'#087a3a',fontWeight:700,cursor:'pointer',fontSize:14}}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Home ─────────────────────────────────────────────────────────────────────
function Home({setPage}){
  return(
    <main>
      <section style={{display:'grid',gridTemplateColumns:'1fr 1.1fr 1.7fr',gap:28,
        padding:'36px 0',alignItems:'center'}}>
        <ProduceHero/>
        <div>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'#f4fbf6',
            border:'1px solid #c3e6cb',borderRadius:20,padding:'6px 14px',
            fontSize:12,color:'#087a3a',fontWeight:700,marginBottom:18}}>
            🤖 AI-Powered Price Forecasting
          </div>
          <h1 style={{fontSize:44,lineHeight:1.06,margin:'0 0 16px'}}>
            Smarter Grocery<br/>
            <span style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',
              WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              Shopping Starts Here.
            </span>
          </h1>
          <p style={{color:'#344054',lineHeight:1.75,fontSize:15,marginBottom:24}}>
            AI-powered price forecasts for Kigali's informal markets.
            Find the cheapest market, track price trends, and budget smarter.
          </p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <button className="primary" onClick={()=>setPage('Pricing')} style={{padding:'13px 24px',fontSize:14}}>
              <LineChart size={16}/> View Prices
            </button>
            <button className="ghost" onClick={()=>setPage('Cost Estimator')} style={{padding:'13px 24px',fontSize:14}}>
              <Wallet size={16}/> Estimate Cost
            </button>
          </div>
          <div style={{display:'flex',gap:28,marginTop:28,paddingTop:20,borderTop:'1px solid #e5e9ef'}}>
            {[['8.27%','Model MAPE'],['0.9845','R² Score'],['5','Markets'],['10','Commodities']].map(([v,l])=>(
              <div key={l}>
                <div style={{fontSize:20,fontWeight:800,color:'#087a3a'}}>{v}</div>
                <div style={{fontSize:11,color:'#667085',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:'grid',gap:14}}>
          <Card style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',
            color:'white',border:'none',padding:'20px 24px'}}>
            <div style={{fontSize:12,opacity:.75,marginBottom:4}}>Today's Best Deal</div>
            <div style={{fontSize:20,fontWeight:700}}>Maize at Nyabugogo</div>
            <div style={{fontSize:32,fontWeight:800,marginTop:6}}>~520 RWF/kg</div>
            <div style={{fontSize:11,opacity:.65,marginTop:10}}>AI predicted · Updated today</div>
          </Card>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {[[<LineChart size={20}/>,'AI Forecasting','7-day price predictions'],
              [<MapPin size={20}/>,'GPS Distance','Find nearest market'],
              [<Wallet size={20}/>,'Basket Cost','Budget planning'],
              [<Bell size={20}/>,'Price Alerts','Stay informed'],
            ].map(([icon,title,desc])=>(
              <Card key={title} style={{padding:'14px 16px'}}>
                <div style={{color:'#087a3a',marginBottom:8}}>{icon}</div>
                <div style={{fontWeight:700,fontSize:13}}>{title}</div>
                <div style={{color:'#667085',fontSize:12,marginTop:2}}>{desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section style={{padding:'8px 0 36px'}}>
        <h2 style={{textAlign:'center',marginBottom:6}}>
          Kigali's Top <span style={{color:'#087a3a'}}>Markets</span>
        </h2>
        <p style={{textAlign:'center',color:'#667085',marginBottom:24,fontSize:14}}>
          Click a market to explore prices and plan your visit
        </p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:16}}>
          {MARKETS.map((m,i)=>(
            <div key={m}
              onClick={()=>setPage('Markets')}
              style={{borderRadius:16,overflow:'hidden',cursor:'pointer',
                boxShadow:'0 4px 16px rgba(0,0,0,0.07)',transition:'transform .2s,box-shadow .2s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-6px)';e.currentTarget.style.boxShadow='0 12px 28px rgba(0,0,0,0.12)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.07)'}}>
              <div style={{height:130,
                background:`url(${MARKET_IMAGES[m]}) center/cover`,position:'relative'}}>
                <div style={{position:'absolute',inset:0,
                  background:'linear-gradient(to top,rgba(0,0,0,0.65),transparent)'}}/>
                <div style={{position:'absolute',bottom:10,left:12,
                  color:'white',fontWeight:700,fontSize:12.5}}>{m}</div>
              </div>
              <div style={{padding:'10px 12px',background:'white'}}>
                <Badge color={i<2?'#087a3a':'#ff6b00'}>{i<2?'Top Market':'Active'}</Badge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

// ── Pricing ──────────────────────────────────────────────────────────────────
function Pricing(){
  const{post}=useApi();
  const userLoc=useLocation();
  const[product,setProduct]=useState('Maize');
  const[market,setMarket]=useState('Kimironko');
  const[forecast,setForecast]=useState(null);
  const[compare,setCompare]=useState([]);
  const[loading,setLoading]=useState(false);

  const fetchData=useCallback(async()=>{
    setLoading(true);
    const dt=nextWeek();
    const[pred,recs]=await Promise.all([
      post('/predict',{commodity:product,market,forecast_date:dt}),
      post('/recommend',{commodity:product,forecast_date:dt}),
    ]);
    setForecast(pred);
    setCompare(recs||[]);
    setLoading(false);
  },[product,market]);

  useEffect(()=>{fetchData();},[fetchData]);

  const price=forecast?.predicted_price_kes||0;
  const bestMarket=compare[0]||null;
  const withDist=compare.map(r=>({...r,dist:distanceTo(r.market,userLoc)}));

  return(
    <main>
      <section style={{display:'grid',gridTemplateColumns:'1fr 1.3fr 2fr',gap:28,
        padding:'32px 0 24px',alignItems:'start'}}>
        <ProduceHero/>
        <div>
          <h1>Smart Prices.<br/>
            <span style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',
              WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              Better Decisions.
            </span>
          </h1>
          <p style={{color:'#344054'}}>AI-powered price forecasts across all Kigali markets, updated daily.</p>
          {userLoc
            ?<Badge>📍 Location detected — showing distances</Badge>
            :<span style={{fontSize:12,color:'#667085'}}>📍 Allow location to see distances to markets</span>
          }
        </div>
        <Card>
          <h3 style={{margin:'0 0 14px'}}>Configure Forecast</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <Sel label="Product" value={product} onChange={setProduct} items={COMMODITIES}/>
            <Sel label="Market"  value={market}  onChange={setMarket}  items={MARKETS}/>
          </div>
          <button className="orange" style={{width:'100%',padding:'13px 0',fontSize:14}}
            onClick={fetchData} disabled={loading}>
            <LineChart size={16}/> {loading?'Forecasting...':'Get Forecast'}
          </button>
        </Card>
      </section>

      {loading?<Spinner/>:(
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1.5fr',gap:16,marginBottom:24}}>
            <Stat icon={<LineChart size={18}/>} label="Predicted Price" value={`${money(price)} RWF/kg`} sub="7 days ahead"/>
            <Stat icon={<Wallet size={18}/>} label="Confidence Range"
              value={forecast?`${money(forecast.confidence_lower)}-${money(forecast.confidence_upper)} RWF`:'---'}
              sub="90% confidence"/>
            <Stat icon={<TrendingUp size={18}/>} label="Price Trend"
              value={<TrendBadge trend={forecast?.trend||'stable'}/>} sub="vs last month"/>
            <Card style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',
              color:'white',border:'none',padding:'18px 22px'}}>
              <div style={{fontSize:11,opacity:.75,marginBottom:4}}>🏅 Best Market Right Now</div>
              <div style={{fontSize:18,fontWeight:700}}>{bestMarket?.market||'---'}</div>
              <div style={{fontSize:26,fontWeight:800,marginTop:6}}>
                {bestMarket?`${money(bestMarket.predicted_price_kes)} RWF`:'---'}
              </div>
              {bestMarket&&<div style={{fontSize:11,opacity:.65,marginTop:8}}>
                Save {money(bestMarket.saving_vs_most_expensive)} RWF vs most expensive
              </div>}
            </Card>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1.8fr 1fr',gap:20,marginBottom:20}}>
            <Card>
              <h3 style={{marginTop:0}}>{EMOJI[product]} {product} — Market Comparison</h3>
              <table>
                <tbody>
                  <tr>
                    <th>Market</th><th>Predicted Price</th>
                    {userLoc&&<th>Distance</th>}
                    <th>Saving</th><th>Status</th>
                  </tr>
                  {withDist.map((r,i)=>(
                    <tr key={r.market}
                      style={{background:i===0?'#f4fbf6':'',
                        transition:'background .15s'}}>
                      <td style={{fontWeight:600}}>{r.market}</td>
                      <td style={{fontWeight:700,color:i===0?'#087a3a':''}}>{money(r.predicted_price_kes)} RWF</td>
                      {userLoc&&<td style={{fontSize:12,color:'#667085'}}>{r.dist?`${r.dist} km`:'---'}</td>}
                      <td style={{color:'#087a3a',fontWeight:600}}>-{money(r.saving_vs_most_expensive)} RWF</td>
                      <td><Badge color={i===0?'#087a3a':i===1?'#ff6b00':'#667085'}>
                        {i===0?'Cheapest':i===1?'Good Value':'Higher'}
                      </Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card>
              <h3 style={{marginTop:0}}>Price by Market</h3>
              <ResponsiveContainer height={230}>
                <BarChart data={withDist.map(r=>({name:r.market.split(' ')[0],price:r.predicted_price_kes}))}>
                  <XAxis dataKey="name" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}}/>
                  <Tooltip formatter={v=>`${money(v)} RWF`}/>
                  <Bar dataKey="price" radius={[6,6,0,0]}>
                    {withDist.map((_,i)=><Cell key={i} fill={i===0?'#087a3a':'#c3e6cb'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}

// ── Markets ──────────────────────────────────────────────────────────────────
function Markets(){
  const userLoc=useLocation();
  const[selected,setSelected]=useState('Kimironko');

  return(
    <main>
      <section style={{padding:'32px 0 20px'}}>
        <h1>Kigali <span style={{color:'#087a3a'}}>Markets</span></h1>
        <p style={{color:'#344054',fontSize:15}}>
          Explore Kigali's top informal markets. Click a market on the map to learn more.
        </p>
        {userLoc
          ?<Badge>📍 Showing your location and distances to each market</Badge>
          :<span style={{fontSize:13,color:'#667085'}}>📍 Allow location to see distances</span>
        }
      </section>

      <div style={{display:'grid',gridTemplateColumns:'1.1fr 1fr',gap:24,marginBottom:28}}>
        <Card style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e9ef'}}>
            <h3 style={{margin:0}}>Interactive Map</h3>
            <p style={{margin:'4px 0 0',fontSize:12,color:'#667085'}}>Click any market pin to select it</p>
          </div>
          <div style={{padding:16}}>
            <LeafletMap userLoc={userLoc} selectedMarket={selected} onSelectMarket={setSelected}/>
          </div>
        </Card>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,alignContent:'start'}}>
          {MARKETS.map((m,i)=>{
            const dist=distanceTo(m,userLoc);
            const isSelected=m===selected;
            return(
              <div key={m} onClick={()=>setSelected(m)}
                style={{borderRadius:14,overflow:'hidden',cursor:'pointer',
                  border:`2px solid ${isSelected?'#087a3a':'transparent'}`,
                  boxShadow:isSelected?'0 0 0 3px #087a3a25':'0 2px 10px rgba(0,0,0,0.06)',
                  transition:'all .2s'}}>
                <div style={{height:96,background:`url(${MARKET_IMAGES[m]}) center/cover`,position:'relative'}}>
                  <div style={{position:'absolute',inset:0,
                    background:'linear-gradient(to top,rgba(0,0,0,0.55),transparent)'}}/>
                  <div style={{position:'absolute',bottom:7,left:10,
                    color:'white',fontWeight:700,fontSize:12}}>{m}</div>
                </div>
                <div style={{padding:'8px 12px',background:'white'}}>
                  {dist&&<div style={{fontSize:11,color:'#087a3a',fontWeight:600,marginBottom:4}}>📍 {dist} km away</div>}
                  <Badge color={i<2?'#087a3a':'#ff6b00'}>{i<2?'High Activity':'Active'}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:16}}>
        {MARKETS.map((m,i)=>{
          const dist=distanceTo(m,userLoc);
          return(
            <Card key={m} style={{padding:0,overflow:'hidden',cursor:'pointer'}}
              onClick={()=>setSelected(m)}>
              <img src={MARKET_IMAGES[m]} alt={m}
                style={{width:'100%',height:90,objectFit:'cover'}}/>
              <div style={{padding:'12px 14px'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>{m}</div>
                {dist&&<div style={{fontSize:11,color:'#087a3a',fontWeight:600,marginBottom:6}}>📍 {dist} km</div>}
                <Badge color={i<2?'#087a3a':'#ff6b00'}>{i<2?'Low Prices':'Good Value'}</Badge>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}

// ── Cost Estimator ────────────────────────────────────────────────────────────
function CostEstimator(){
  const{post}=useApi();
  const[market,setMarket]=useState('Kimironko');
  const[product,setProduct]=useState('Maize');
  const[qty,setQty]=useState('1');
  const[items,setItems]=useState([
    {commodity:'Maize',      quantity_kg:2},
    {commodity:'Beans (Dry)',quantity_kg:1},
    {commodity:'Rice',       quantity_kg:2},
    {commodity:'Potatoes',   quantity_kg:1.5},
  ]);
  const[result,setResult]=useState(null);
  const[loading,setLoading]=useState(false);

  const runBasket=async(ci=items,cm=market)=>{
    setLoading(true);
    const d=await post('/basket',{market:cm,forecast_date:nextWeek(),items:ci});
    setResult(d);setLoading(false);
  };

  useEffect(()=>{runBasket();},[market]);

  const addItem=()=>{
    const n=[...items,{commodity:product,quantity_kg:Number(qty)||1}];
    setItems(n);runBasket(n);
  };

  const removeItem=idx=>{
    const n=items.filter((_,i)=>i!==idx);
    setItems(n);runBasket(n);
  };

  const display=result?.items||items.map(i=>({...i,unit_price_kes:0,line_total_kes:0}));
  const total=result?.total_kes||0;

  return(
    <main>
      <section style={{padding:'32px 0 24px'}}>
        <h1>Cost <span style={{color:'#087a3a'}}>Estimator</span></h1>
        <p style={{color:'#344054',fontSize:15}}>
          Build your shopping list and get AI-predicted costs before heading to market.
        </p>
      </section>

      <div style={{display:'grid',gridTemplateColumns:'1.6fr 1fr',gap:24}}>
        <div style={{display:'grid',gap:16}}>
          <Card>
            <h3 style={{marginTop:0}}>Add Items to Basket</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 90px 48px',gap:12,alignItems:'end'}}>
              <Sel label="Product" value={product} onChange={setProduct} items={COMMODITIES}/>
              <Sel label="Market"  value={market}  onChange={setMarket}  items={MARKETS}/>
              <Inp label="Qty (kg)" type="number" value={qty} onChange={setQty}/>
              <button className="orange" onClick={addItem}
                style={{marginTop:22,padding:'12px 14px',borderRadius:10}}>
                <Plus size={16}/>
              </button>
            </div>
          </Card>

          <Card>
            <h3 style={{marginTop:0}}>Your Basket at {market}</h3>
            {loading?<Spinner/>:(
              <table>
                <tbody>
                  <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th><th></th></tr>
                  {display.map((r,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{EMOJI[r.commodity]} {r.commodity}</td>
                      <td>{r.quantity_kg} kg</td>
                      <td>{money(r.unit_price_kes)} RWF</td>
                      <td style={{fontWeight:700}}>{money(r.line_total_kes)} RWF</td>
                      <td>
                        <button onClick={()=>removeItem(i)}
                          style={{background:'#fff5f5',border:'1px solid #fca5a5',
                            borderRadius:6,padding:'4px 6px',cursor:'pointer',color:'#d92d20'}}>
                          <Trash2 size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{borderTop:'2px solid #e5e9ef',background:'#f4fbf6'}}>
                    <td colSpan={3} style={{fontWeight:700,fontSize:16}}>Total</td>
                    <td colSpan={2} style={{fontWeight:800,fontSize:22,color:'#087a3a'}}>{money(total)} RWF</td>
                  </tr>
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div style={{display:'grid',gap:16,alignContent:'start'}}>
          <Card style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',color:'white',border:'none',padding:'22px'}}>
            <div style={{fontSize:11,opacity:.75}}>Basket Total at</div>
            <div style={{fontSize:20,fontWeight:700,marginTop:4}}>{market}</div>
            <div style={{fontSize:36,fontWeight:800,marginTop:8}}>{money(total)} RWF</div>
            <div style={{fontSize:11,opacity:.6,marginTop:10}}>
              {result?.model_used||'XGBoost (tuned)'} · AI predicted
            </div>
          </Card>

          <Card>
            <h3 style={{marginTop:0}}>Breakdown</h3>
            <ResponsiveContainer height={190}>
              <PieChart>
                <Pie data={display.map(r=>({name:r.commodity,value:r.line_total_kes||0}))}
                  dataKey="value" outerRadius={72} innerRadius={38}>
                  {display.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                </Pie>
                <Tooltip formatter={v=>`${money(v)} RWF`}/>
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <button className="orange" onClick={()=>runBasket()} disabled={loading} style={{padding:'14px 0',borderRadius:10}}>
            {loading?'Recalculating...':'Recalculate Basket'}
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Alerts ────────────────────────────────────────────────────────────────────
function Alerts(){
  const{get}=useApi();
  const[commodity,setCommodity]=useState('Maize');
  const[market,setMarket]=useState('Kimironko');
  const[threshold,setThreshold]=useState('1000');
  const[result,setResult]=useState(null);
  const[loading,setLoading]=useState(false);

  const check=async()=>{
    setLoading(true);
    const d=await get(`/alerts/${commodity}?threshold_kes=${threshold}&market=${market}`);
    setResult(d);setLoading(false);
  };

  useEffect(()=>{check();},[commodity,market,threshold]);

  return(
    <main>
      <section style={{padding:'32px 0 24px'}}>
        <h1>Price <span style={{color:'#087a3a'}}>Alerts</span></h1>
        <p style={{color:'#344054',fontSize:15}}>Set a budget and instantly check if AI-predicted prices are within range.</p>
      </section>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1.6fr',gap:24}}>
        <div style={{display:'grid',gap:16,alignContent:'start'}}>
          <Card>
            <h3 style={{marginTop:0}}>Configure Alert</h3>
            <div style={{display:'grid',gap:14}}>
              <Sel label="Commodity" value={commodity} onChange={setCommodity} items={COMMODITIES}/>
              <Sel label="Market"    value={market}    onChange={setMarket}    items={MARKETS}/>
              <Inp label="Budget Threshold (RWF/kg)" type="number" value={threshold} onChange={setThreshold}/>
              <button className="orange" onClick={check} disabled={loading} style={{padding:'13px 0'}}>
                <Bell size={16}/> {loading?'Checking...':'Check Alert'}
              </button>
            </div>
          </Card>

          {result&&(
            <Card style={{
              background:result.alert
                ?'linear-gradient(135deg,#fff5f5,#ffe4e4)'
                :'linear-gradient(135deg,#f4fbf6,#e8f5ec)',
              border:`1px solid ${result.alert?'#fca5a5':'#86efac'}`
            }}>
              <div style={{fontSize:36,marginBottom:10}}>{result.alert?'⚠️':'✅'}</div>
              <div style={{fontWeight:700,fontSize:17,color:result.alert?'#d92d20':'#087a3a'}}>
                {result.alert?'Price Alert Active':'Within Budget'}
              </div>
              <div style={{fontSize:30,fontWeight:800,margin:'10px 0',color:result.alert?'#d92d20':'#087a3a'}}>
                {money(result.predicted_price_kes)} RWF/kg
              </div>
              <div style={{fontSize:13,color:'#344054',lineHeight:1.7}}>{result.message}</div>
              <div style={{display:'flex',gap:10,marginTop:12,flexWrap:'wrap'}}>
                <Badge color={result.alert?'#d92d20':'#087a3a'}>
                  {result.alert?'Above Budget':'Within Budget'}
                </Badge>
                <TrendBadge trend={result.trend}/>
              </div>
            </Card>
          )}
        </div>

        <Card>
          <h3 style={{marginTop:0}}>Price Watch Overview</h3>
          <table>
            <tbody>
              <tr><th>Commodity</th><th>Market</th><th>Threshold</th><th>Status</th></tr>
              {COMMODITIES.slice(0,6).map((c,i)=>(
                <tr key={c}>
                  <td>{EMOJI[c]} {c}</td>
                  <td>{MARKETS[i%MARKETS.length]}</td>
                  <td>{money(800+i*200)} RWF</td>
                  <td><Badge color={i%2===0?'#087a3a':'#ff6b00'}>{i%2===0?'Within Budget':'Monitor'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </main>
  );
}

// ── Sellers ──────────────────────────────────────────────────────────────────
function Sellers(){
  const{get,post,put,del}=useApi();
  const{user}=useAuth();
  const[products,setProducts]=useState([]);
  const[insights,setInsights]=useState(null);
  const[loading,setLoading]=useState(false);
  const[form,setForm]=useState({commodity:'Maize',market:'Kimironko',price_rwf:'',quantity_kg:'1',unit:'kg'});
  const[editId,setEditId]=useState(null);
  const[editPrice,setEditPrice]=useState('');
  const set=k=>v=>setForm(f=>({...f,[k]:v}));

  const load=async()=>{
    setLoading(true);
    const d=await get('/seller/products');
    if(d)setProducts(d.products);
    setLoading(false);
  };

  useEffect(()=>{if(user&&(user.role==='seller'||user.role==='admin'))load();},[user]);

  const addProduct=async()=>{
    if(!form.price_rwf)return;
    await post('/seller/products',{
      ...form,price_rwf:Number(form.price_rwf),quantity_kg:Number(form.quantity_kg)||1
    });
    load();setForm(f=>({...f,price_rwf:''}));
  };

  const saveEdit=async id=>{
    await put(`/seller/products/${id}`,{price_rwf:Number(editPrice)});
    setEditId(null);load();
  };

  const remove=async id=>{
    if(!confirm('Delete this listing?'))return;
    await del(`/seller/products/${id}`);load();
  };

  const loadInsights=async c=>{
    const d=await get(`/seller/insights/${c}`);
    if(d)setInsights(d);
  };

  if(!user||user.role==='consumer'){
    return(
      <main style={{textAlign:'center',padding:'80px 0'}}>
        <div style={{fontSize:64,marginBottom:16}}>🏪</div>
        <h2 style={{marginBottom:12}}>Seller <span style={{color:'#087a3a'}}>Dashboard</span></h2>
        <p style={{color:'#667085',marginBottom:24,fontSize:15}}>
          Sign in as a seller to manage your listings and compare prices.
        </p>
        <div style={{display:'inline-flex',gap:12}}>
          <button className="primary" style={{padding:'13px 24px'}}>Sign In as Seller</button>
        </div>
      </main>
    );
  }

  return(
    <main>
      <section style={{padding:'32px 0 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h1 style={{margin:0}}>Seller <span style={{color:'#087a3a'}}>Dashboard</span></h1>
          <p style={{color:'#344054',marginTop:8}}>Manage listings and track AI price comparisons in real time.</p>
        </div>
        <div style={{display:'flex',gap:16}}>
          <Stat icon={<Store size={16}/>}   label="Listings"     value={products.length}                                         color="#087a3a"/>
          <Stat icon={<Bell size={16}/>}    label="Above Market" value={products.filter(p=>p.price_status==='above_market').length} color="#d92d20"/>
        </div>
      </section>

      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:24}}>
        <div style={{display:'grid',gap:16}}>
          <Card>
            <h3 style={{marginTop:0}}>Add New Listing</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Sel label="Commodity" value={form.commodity}
                onChange={v=>{set('commodity')(v);loadInsights(v);}} items={COMMODITIES}/>
              <Sel label="Market" value={form.market} onChange={set('market')} items={MARKETS}/>
              <Inp label="Your Price (RWF/kg)" type="number" value={form.price_rwf}
                onChange={set('price_rwf')} placeholder="e.g. 520"/>
              <Inp label="Quantity (kg)" type="number" value={form.quantity_kg} onChange={set('quantity_kg')}/>
            </div>
            <button className="primary" style={{marginTop:14,padding:'13px 0',width:'100%'}} onClick={addProduct}>
              <Plus size={16}/> Add Listing
            </button>
          </Card>

          <Card>
            <h3 style={{marginTop:0}}>My Listings</h3>
            {loading?<Spinner/>:(
              products.length===0
                ?<div style={{textAlign:'center',padding:28,color:'#667085'}}>No listings yet. Add your first product above.</div>
                :<table>
                   <tbody>
                     <tr><th>Product</th><th>Market</th><th>Your Price</th><th>AI Price</th><th>Status</th><th>Actions</th></tr>
                     {products.map(p=>(
                       <tr key={p.id}>
                         <td>{EMOJI[p.commodity]} {p.commodity}</td>
                         <td style={{fontSize:12}}>{p.market}</td>
                         <td>
                           {editId===p.id
                             ?<div style={{display:'flex',gap:6}}>
                                <input type="number" value={editPrice}
                                  onChange={e=>setEditPrice(e.target.value)}
                                  style={{width:80,padding:'4px 8px',border:'1px solid #e5e9ef',
                                    borderRadius:6,fontSize:13}}/>
                                <button onClick={()=>saveEdit(p.id)}
                                  style={{background:'#087a3a',color:'white',border:'none',
                                    borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:12}}>
                                  Save
                                </button>
                                <button onClick={()=>setEditId(null)}
                                  style={{background:'#f4f4f4',border:'none',
                                    borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:12}}>
                                  ✕
                                </button>
                              </div>
                             :<b>{money(p.price_rwf)} RWF</b>
                           }
                         </td>
                         <td style={{color:'#087a3a',fontWeight:600}}>{money(p.ai_price_rwf)} RWF</td>
                         <td>
                           <Badge color={
                             p.price_status==='above_market'?'#d92d20':
                             p.price_status==='below_market'?'#087a3a':'#667085'}>
                             {p.price_status==='above_market'?'Above Market':
                              p.price_status==='below_market'?'Below Market':'At Market'}
                           </Badge>
                         </td>
                         <td>
                           <div style={{display:'flex',gap:6}}>
                             <button onClick={()=>{setEditId(p.id);setEditPrice(p.price_rwf);}}
                               style={{background:'#f4fbf6',border:'1px solid #c3e6cb',
                                 borderRadius:6,padding:'5px 8px',cursor:'pointer',color:'#087a3a'}}>
                               <Pencil size={12}/>
                             </button>
                             <button onClick={()=>remove(p.id)}
                               style={{background:'#fff5f5',border:'1px solid #fca5a5',
                                 borderRadius:6,padding:'5px 8px',cursor:'pointer',color:'#d92d20'}}>
                               <Trash2 size={12}/>
                             </button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
            )}
          </Card>
        </div>

        <div style={{display:'grid',gap:16,alignContent:'start'}}>
          {insights&&(
            <Card>
              <h3 style={{marginTop:0}}>AI Market Insights — {insights.commodity}</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                <div style={{background:'#f4fbf6',borderRadius:10,padding:12}}>
                  <div style={{fontSize:11,color:'#667085'}}>Cheapest</div>
                  <div style={{fontWeight:700,color:'#087a3a',marginTop:2}}>{insights.cheapest}</div>
                </div>
                <div style={{background:'#fff5f5',borderRadius:10,padding:12}}>
                  <div style={{fontSize:11,color:'#667085'}}>Most Expensive</div>
                  <div style={{fontWeight:700,color:'#d92d20',marginTop:2}}>{insights.most_expensive}</div>
                </div>
              </div>
              <ResponsiveContainer height={160}>
                <BarChart data={insights.market_prices.map(m=>({
                  name:m.market.split(' ')[0],price:m.ai_price}))}>
                  <XAxis dataKey="name" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}}/>
                  <Tooltip formatter={v=>`${money(v)} RWF`}/>
                  <Bar dataKey="price" radius={[4,4,0,0]}>
                    {insights.market_prices.map((_,i)=><Cell key={i} fill={i===0?'#087a3a':'#c3e6cb'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <h3 style={{marginTop:0}}>How to Price Smart</h3>
            <div style={{display:'grid',gap:10}}>
              {[
                ['🟢','Below Market','Your price is lower than AI forecast — great for attracting buyers'],
                ['🟡','At Market','Your price matches the AI forecast closely'],
                ['🔴','Above Market','Your price is higher than AI forecast — consider adjusting'],
              ].map(([dot,title,desc])=>(
                <div key={title} style={{display:'flex',gap:10,padding:'10px 12px',
                  background:'#f8f9fa',borderRadius:8}}>
                  <span style={{fontSize:16}}>{dot}</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:13}}>{title}</div>
                    <div style={{fontSize:12,color:'#667085',marginTop:2}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────
function About(){
  return(
    <main>
      <section style={{display:'grid',gridTemplateColumns:'1fr 1.4fr 1.5fr',gap:28,
        padding:'32px 0',alignItems:'center'}}>
        <ProduceHero/>
        <div>
          <h1>About <span style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',
            WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>SokoPrice</span></h1>
          <p style={{lineHeight:1.8,fontSize:15}}>
            SokoPrice is an AI-powered platform helping Kigali shoppers make smarter
            grocery decisions with accurate price forecasts, market comparisons,
            and GPS-based distance recommendations.
          </p>
          <div style={{display:'flex',gap:10,marginTop:16,flexWrap:'wrap'}}>
            <Badge>BSc Software Engineering</Badge>
            <Badge color="#ff6b00">ALU Capstone 2026</Badge>
            <Badge color="#845ec2">CRISP-DM</Badge>
          </div>
        </div>
        <Card style={{background:'linear-gradient(135deg,#087a3a,#0aab50)',color:'white',border:'none',padding:'24px'}}>
          <div style={{fontSize:12,opacity:.75,marginBottom:12}}>Our Mission</div>
          <p style={{fontSize:17,lineHeight:1.75,fontStyle:'italic',margin:0}}>
            "Make grocery prices clear, fair, and accessible for all Kigali households."
          </p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:22}}>
            {[['8.27%','MAPE'],['0.9845','R²'],['5','Markets'],['10','Commodities']].map(([v,l])=>(
              <div key={l} style={{background:'rgba(255,255,255,.15)',borderRadius:10,padding:'12px 14px'}}>
                <div style={{fontSize:22,fontWeight:800}}>{v}</div>
                <div style={{fontSize:11,opacity:.75,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,marginBottom:24}}>
        {[
          ['🎯','Mission','Empower Kigali households with AI-driven price insights that reduce information asymmetry between vendors and consumers.'],
          ['🔭','Vision','A future where every Kigali household has equal access to market intelligence for fair, informed purchasing decisions.'],
          ['⚙️','Technology','XGBoost on WFP proxy data. FastAPI backend. React + Leaflet frontend. Rolling window validation. SQLite database.'],
        ].map(([icon,title,desc])=>(
          <Card key={title}>
            <div style={{fontSize:34,marginBottom:12}}>{icon}</div>
            <h3 style={{marginTop:0,marginBottom:8}}>{title}</h3>
            <p style={{color:'#344054',fontSize:14,lineHeight:1.75,margin:0}}>{desc}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}

// ── Admin ─────────────────────────────────────────────────────────────────────
function Admin(){
  const{get,put,upload}=useApi();
  const{user}=useAuth();
  const[stats,setStats]=useState(null);
  const[users,setUsers]=useState([]);
  const[products,setProducts]=useState([]);
  const[tab,setTab]=useState('overview');
  const[uploading,setUploading]=useState(false);
  const[uploadMsg,setUploadMsg]=useState('');
  const fileRef=useRef(null);

  useEffect(()=>{
    if(!user||user.role!=='admin')return;
    get('/admin/stats').then(d=>d&&setStats(d));
    get('/admin/users').then(d=>d&&setUsers(d.users));
    get('/admin/products').then(d=>d&&setProducts(d.products));
  },[user]);

  const suspendUser=async id=>{
    await put(`/admin/users/${id}/suspend`,{});
    get('/admin/users').then(d=>d&&setUsers(d.users));
  };

  const handleUpload=async e=>{
    const file=e.target.files[0];if(!file)return;
    setUploading(true);setUploadMsg('');
    const fd=new FormData();fd.append('file',file);
    const res=await upload('/admin/upload-prices',fd);
    setUploading(false);
    setUploadMsg(res?`Added ${res.rows_added} price records successfully.`:'Upload failed. Check CSV format.');
    e.target.value='';
  };

  if(!user||user.role!=='admin'){
    return(
      <main style={{textAlign:'center',padding:'80px 0'}}>
        <div style={{fontSize:64}}>🔒</div>
        <h2>Admin Access Only</h2>
        <p style={{color:'#667085'}}>This area is restricted to administrators.</p>
      </main>
    );
  }

  const TABS=[['overview','📊 Overview'],['users','👥 Users'],['products','🏪 Products'],['data','📂 Data']];

  return(
    <main>
      <section style={{padding:'32px 0 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#fff5e6',
            border:'1px solid #fed7aa',borderRadius:20,padding:'6px 14px',
            fontSize:12,color:'#ff6b00',fontWeight:700,marginBottom:12}}>
            <Shield size={13}/> Admin Dashboard · Restricted Access
          </div>
          <h1 style={{margin:0}}>Platform <span style={{color:'#087a3a'}}>Control Centre</span></h1>
        </div>
        <div style={{display:'flex',gap:8}}>
          {TABS.map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{padding:'10px 18px',borderRadius:10,border:'1px solid',
                borderColor:tab===t?'#087a3a':'#e5e9ef',
                background:tab===t?'#087a3a':'white',
                color:tab===t?'white':'#344054',
                fontWeight:600,cursor:'pointer',fontSize:13,transition:'all .15s'}}>
              {l}
            </button>
          ))}
        </div>
      </section>

      {tab==='overview'&&stats&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:16,marginBottom:24}}>
            <Stat icon={<Users size={18}/>}        label="Total Users"    value={stats.total_users}           color="#087a3a"/>
            <Stat icon={<Store size={18}/>}        label="Sellers"        value={stats.total_sellers}         color="#ff6b00"/>
            <Stat icon={<ShoppingBasket size={18}/>} label="Products"     value={stats.total_products}        color="#845ec2"/>
            <Stat icon={<LineChart size={18}/>}    label="Forecasts"      value={stats.total_forecasts}       color="#3498db"/>
            <Stat icon={<CheckCircle size={18}/>}  label="Price Records"  value={stats.total_price_records}   color="#087a3a"/>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1.6fr 1fr',gap:20}}>
            <Card>
              <h3 style={{marginTop:0}}>Recent Forecast Requests</h3>
              <table>
                <tbody>
                  <tr><th>Commodity</th><th>Market</th><th>Predicted</th><th>Time</th></tr>
                  {stats.recent_forecasts?.map((f,i)=>(
                    <tr key={i}>
                      <td>{EMOJI[f.commodity]} {f.commodity}</td>
                      <td style={{fontSize:12}}>{f.market}</td>
                      <td style={{fontWeight:700}}>{money(f.predicted_rwf)} RWF</td>
                      <td style={{fontSize:11,color:'#667085'}}>
                        {new Date(f.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card>
              <h3 style={{marginTop:0}}>Top Requested Commodities</h3>
              <ResponsiveContainer height={210}>
                <PieChart>
                  <Pie data={stats.top_commodities?.map(c=>({name:c.commodity,value:c.requests}))}
                    dataKey="value" outerRadius={78} innerRadius={40}>
                    {stats.top_commodities?.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
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
                  <td>
                    {u.role!=='admin'&&(
                      <button onClick={()=>suspendUser(u.id)}
                        style={{background:u.active?'#fff5f5':'#f4fbf6',
                          border:`1px solid ${u.active?'#fca5a5':'#86efac'}`,
                          borderRadius:8,padding:'5px 10px',cursor:'pointer',
                          color:u.active?'#d92d20':'#087a3a',fontSize:12,fontWeight:600}}>
                        {u.active?'Suspend':'Reactivate'}
                      </button>
                    )}
                  </td>
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
              <tr><th>Commodity</th><th>Market</th><th>Price</th><th>Seller</th><th>Email</th><th>Status</th></tr>
              {products.map(p=>(
                <tr key={p.id}>
                  <td>{EMOJI[p.commodity]} {p.commodity}</td>
                  <td style={{fontSize:12}}>{p.market}</td>
                  <td style={{fontWeight:700}}>{money(p.price_rwf)} RWF</td>
                  <td>{p.seller_name}</td>
                  <td style={{fontSize:11,color:'#667085'}}>{p.seller_email}</td>
                  <td><Badge color={p.status==='active'?'#087a3a':'#667085'}>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab==='data'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <Card>
            <h3 style={{marginTop:0}}>Upload Real Price Data</h3>
            <p style={{color:'#344054',fontSize:14,lineHeight:1.8}}>
              Upload a CSV with real Kigali market prices to improve AI predictions.
              Once uploaded, the model will use real price history instead of proxy data.
            </p>
            <div style={{background:'#f4fbf6',border:'2px dashed #c3e6cb',
              borderRadius:12,padding:24,textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:36,marginBottom:8}}>📂</div>
              <div style={{fontWeight:600,marginBottom:8,fontSize:14}}>CSV Format Required</div>
              <code style={{fontSize:12,color:'#667085',display:'block',background:'#e8f5ec',
                padding:'8px 12px',borderRadius:6,lineHeight:2}}>
                commodity, market, price_rwf, price_date<br/>
                Maize, Kimironko, 520, 2026-07-01<br/>
                Beans (Dry), Nyabugogo, 1200, 2026-07-01
              </code>
            </div>
            {uploadMsg&&(
              <div style={{background:'#f4fbf6',border:'1px solid #86efac',borderRadius:8,
                padding:12,marginBottom:12,fontSize:13,color:'#087a3a'}}>{uploadMsg}</div>
            )}
            <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} style={{display:'none'}}/>
            <button className="orange" style={{width:'100%',padding:'14px 0',borderRadius:10}}
              onClick={()=>fileRef.current.click()} disabled={uploading}>
              <Upload size={16}/> {uploading?'Uploading...':'Upload CSV'}
            </button>
          </Card>

          <Card>
            <h3 style={{marginTop:0}}>System Information</h3>
            <div style={{display:'grid',gap:10}}>
              {[
                ['Model','XGBoost (tuned)'],
                ['MAPE','8.27%'],
                ['R² Score','0.9845'],
                ['Markets','5 Kigali markets'],
                ['Commodities','10 staple foods'],
                ['Price Unit','RWF (Rwandan Francs)'],
                ['Training Data','WFP Kenya (proxy)'],
                ['Validation','Rolling window — 3yr train → 1yr predict'],
                ['Database','SQLite (sokoprice.db)'],
                ['Auth','JWT token-based'],
              ].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'9px 12px',background:'#f8f9fa',borderRadius:8}}>
                  <span style={{color:'#667085',fontSize:13}}>{k}</span>
                  <span style={{fontWeight:700,fontSize:13}}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
function App(){
  const[page,setPage]=useState('Home');
  const[user,setUser]=useState(()=>{
    const t=localStorage.getItem('sp_token');
    if(!t)return null;
    try{
      const payload=JSON.parse(atob(t.split('.')[0]));
      if(payload.exp<Date.now()/1000){localStorage.removeItem('sp_token');return null;}
      return payload;
    }catch{return null;}
  });

  const logout=()=>{
    localStorage.removeItem('sp_token');
    setUser(null);
    setPage('Home');
  };

  useEffect(()=>{
    if(location.hash==='#admin'&&user?.role==='admin')setPage('Admin');
  },[user]);

  const PAGES={
    Home,Pricing,Markets,'Cost Estimator':CostEstimator,
    Sellers,Alerts,About,Admin,Login,Register
  };
  const Page=PAGES[page]||Home;

  return(
    <AuthCtx.Provider value={{user,setUser,logout}}>
      <Layout page={page} setPage={setPage}>
        <Page setPage={setPage}/>
      </Layout>
    </AuthCtx.Provider>
  );
}

createRoot(document.getElementById('root')).render(<App/>);
