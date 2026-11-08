import { useState } from 'react'
import { LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../services/authContext'
import { supabase } from '../services/supabase'
export default function AccountMenu() {
  const { session, loading } = useAuth()
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  async function signOut() {
    if (!supabase) return
    setBusy(true); setError('')
    try { const { error } = await supabase.auth.signOut(); if (error) throw error }
    catch { setError('Could not sign out. Please try again.') }
    finally { setBusy(false) }
  }
  if (loading) return <span className="auth-loading" role="status">Loading account…</span>
  if (!session) return <a className="auth-signin-link" href="/login" aria-label="Sign in"><UserRound size={15}/><span>Sign in</span></a>
  return <div className="auth-account-menu"><span title={session.user.email}>Signed in</span><button aria-label="Sign out" onClick={signOut} disabled={busy}><LogOut size={14}/><span>{busy ? 'Signing out…' : 'Sign out'}</span></button>{error && <span role="alert">{error}</span>}</div>
}
