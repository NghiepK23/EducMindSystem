/* EducMind · js/08-theme.js
   Chế độ sáng / tối do người dùng chọn (ghi nhớ trong localStorage). */
/* ===== Chế độ sáng / tối do người dùng chọn (ghi nhớ trong localStorage) ===== */
let THEME=(function(){
  try{const v=localStorage.getItem('educmind.theme');if(v==='light'||v==='dark')return v}catch(e){}
  try{return (window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){}
  return 'light';
})();
function applyTheme(){
  const r=document.documentElement;
  r.setAttribute('data-theme',THEME);
  r.style.colorScheme=THEME;
  const m=document.querySelector('meta[name="theme-color"]:not([media])');
  if(m)m.setAttribute('content',THEME==='dark'?'#000000':'#f5f5f7');
}
function setTheme(t){THEME=(t==='dark')?'dark':'light';applyTheme();
  try{localStorage.setItem('educmind.theme',THEME)}catch(e){}
  render();
  if(typeof toast==='function')toast(THEME==='dark'?'Đã bật chế độ tối':'Đã bật chế độ sáng');
}
function toggleTheme(){setTheme(THEME==='dark'?'light':'dark')}
function themeBtn(){
  /* data-noicon + data-iconified: không để iconifyButtons() thay icon mặt trời/mặt trăng */
  const dark=THEME==='dark',label=dark?'Chuyển sang chế độ sáng':'Chuyển sang chế độ tối';
  return `<button type='button' class='btn light icon-only theme-btn' data-noicon='1' data-iconified='1' onclick='toggleTheme()' aria-label='${label}' title='${label}' aria-pressed='${dark}'>${ic(dark?'sun':'moon',18)}<span class='sr'>${label}</span></button>`;
}
applyTheme();
