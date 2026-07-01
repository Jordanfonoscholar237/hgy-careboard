export default function Home(){
  return (
    <main style={{fontFamily:'Inter, system-ui, sans-serif', minHeight:'100vh', display:'grid', placeItems:'center', background:'#07131f', color:'#f3fbff'}}>
      <script dangerouslySetInnerHTML={{__html:"location.replace('/index.html');"}} />
      <a href="/index.html" style={{color:'#8eeaf1'}}>Open LifeView Central</a>
    </main>
  );
}
