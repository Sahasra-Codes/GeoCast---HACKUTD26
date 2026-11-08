import {useEffect,type ReactNode} from 'react'
import {useAuth} from '../services/authContext'
import Login from './Login'
export default function AuthGate({children}:{children:ReactNode}){
 const {session,loading}=useAuth()
 const isLogin=window.location.pathname.replace(/\/+$/,'')==='/login'
 useEffect(()=>{
  if(!loading&&!session&&!isLogin){
   const next=window.location.pathname+window.location.search+window.location.hash
   window.location.replace('/login?'+new URLSearchParams({next}))
  }
 },[session,loading,isLogin])
 if(loading)return <main className="auth-session-loading" role="status">Checking your sign-in...</main>
 if(isLogin)return <Login/>
 if(!session)return <main className="auth-session-loading" role="status">Opening sign-in...</main>
 return children
}
