export function safeLoginDestination(value:string|null){
 if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020]/.test(value))return '/map'
 try{const parsed=new URL(value,'https://geocast.local');if(parsed.origin!=='https://geocast.local'||parsed.pathname.replace(/\/+$/,'')==='/login')return '/map';return parsed.pathname+parsed.search+parsed.hash}catch{return '/map'}
}
export const loginReturnKey='geocast.loginReturn'
