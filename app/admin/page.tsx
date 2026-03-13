'use client'

import { useState, useEffect, useMemo } from 'react' 
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  Trophy, 
  Download, 
  ExternalLink, 
  Loader2, 
  AlertCircle,
  Search,
  Lock, 
  User,
  X,
  ZoomIn,
  ZoomOut,
  Save,
  CheckCircle2,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

const TARGET_CAMPAIGN_NAME = process.env.NEXT_PUBLIC_CAMPAIGN || 'FuryMotocorp';

const GIVEAWAY_SCHEDULE = [
  { label: 'Sorteo 09/03', start: '2000-01-01T00:00:00', end: '2026-03-09T00:00:00' },
  { label: 'Sorteo 16/03', start: '2026-03-09T00:00:00', end: '2026-03-16T00:00:00' },
  { label: 'Sorteo 23/03', start: '2026-03-16T00:00:00', end: '2026-03-23T00:00:00' },
  { label: 'Sorteo 30/03', start: '2026-03-23T00:00:00', end: '2026-03-30T00:00:00' },
  { label: 'Sorteo 06/04', start: '2026-03-30T00:00:00', end: '2026-04-06T00:00:00' },
  { label: 'Sorteo 13/04', start: '2026-04-06T00:00:00', end: '2026-04-13T00:00:00' },
  { label: 'Sorteo 20/04', start: '2026-04-13T00:00:00', end: '2026-04-20T00:00:00' },
  { label: 'Sorteo 27/04', start: '2026-04-20T00:00:00', end: '2026-04-27T00:00:00' },
]

export default function AdminAlternativoPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [campaign, setCampaign] = useState<any>(null)
  const [activeGiveaway, setActiveGiveaway] = useState(GIVEAWAY_SCHEDULE[0])
  const [registrations, setRegistrations] = useState<any[]>([])
  
  // --- NUEVOS ESTADOS PARA GANADORES GUARDADOS ---
  const [savedWinners, setSavedWinners] = useState<any[]>([])
  const [savingWinner, setSavingWinner] = useState(false)
  
  const [loading, setLoading] = useState(true)
  const [winner, setWinner] = useState<any>(null)
  
  const [searchTerm, setSearchTerm] = useState('')

  // --- ESTADOS PARA EL MODAL DEL VOUCHER ---
  const [selectedVoucher, setSelectedVoucher] = useState<string | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)

  useEffect(() => {
    const session = sessionStorage.getItem('admin_auth')
    if (session === 'true') {
      setIsAuthenticated(true)
    }
    setAuthChecking(false)
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (username === 'adminFURY' && password === 'FURY$$2026') {
      setIsAuthenticated(true)
      sessionStorage.setItem('admin_auth', 'true')
      setLoginError('')
    } else {
      setLoginError('Usuario o contraseña incorrectos')
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;

    async function initCampaign() {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('name', TARGET_CAMPAIGN_NAME)
        .single()
      
      if (data) {
        setCampaign(data)
      } else {
        console.error("Campaña no encontrada o error:", error)
        setLoading(false)
      }
    }
    initCampaign()
  }, [isAuthenticated])

  useEffect(() => {
    if (campaign?.id && isAuthenticated) {
      setSearchTerm('')
      fetchRegistrations(campaign.id)
      fetchSavedWinners(campaign.id)
    }
  }, [campaign, activeGiveaway, isAuthenticated])

  async function fetchRegistrations(id: string) {
    setLoading(true)
    setWinner(null)
    const { data } = await supabase
      .from('registrations')
      .select('*')
      .eq('campaign_id', id)
      .gte('created_at', activeGiveaway.start)
      .lt('created_at', activeGiveaway.end)
      .order('created_at', { ascending: false })
    
    if (data) setRegistrations(data)
    setLoading(false)
  }

  // --- OBTENER GANADORES GUARDADOS DE LA SEMANA ACTUAL ---
  async function fetchSavedWinners(id: string) {
    const currentWeekIndex = GIVEAWAY_SCHEDULE.findIndex(g => g.label === activeGiveaway.label) + 1;
    
    const { data, error } = await supabase
      .from('raffle_winners')
      .select(`
        id,
        created_at,
        registrations (
          id, full_name, phone, email, dni, voucher_url
        )
      `)
      .eq('campaign_id', id)
      .eq('week_number', currentWeekIndex)
      .order('created_at', { ascending: true })

    if (error) {
      console.error("Error cargando ganadores guardados:", error)
    } else if (data) {
      // Aplanamos la estructura para facilitar el renderizado
      const formattedWinners = data.map(w => ({
        winner_record_id: w.id,
        ...w.registrations
      }))
      setSavedWinners(formattedWinners)
    }
  }

  const filteredRegistrations = useMemo(() => {
    if (!searchTerm) return registrations;

    const term = searchTerm.toLowerCase();
    return registrations.filter(reg => {
      const phoneStr = reg.phone ? String(reg.phone).toLowerCase() : '';
      const emailStr = reg.email ? String(reg.email).toLowerCase() : '';
      
      return phoneStr.includes(term) || emailStr.includes(term);
    });
  }, [registrations, searchTerm]);

  const pickRandomWinner = () => {
    const currentList = filteredRegistrations.length > 0 ? filteredRegistrations : registrations;
    
    if (currentList.length === 0) return;
    const randomIndex = Math.floor(Math.random() * currentList.length)
    setWinner(currentList[randomIndex])
  }

  // --- GUARDAR GANADOR OFICIAL ---
  const saveWinnerOfficial = async () => {
    if (!winner || !campaign) return;
    
    // Calculamos el week_number basado en la pestaña activa
    const currentWeekIndex = GIVEAWAY_SCHEDULE.findIndex(g => g.label === activeGiveaway.label) + 1;
    setSavingWinner(true);

    try {
      const { data, error } = await supabase
        .from('raffle_winners')
        .insert({
          campaign_id: campaign.id,
          registration_id: winner.id,
          week_number: currentWeekIndex
        })
        .select();

      if (error) {
        if (error.code === '23505') { // Código de error de restricción UNIQUE (ya existe)
            alert("Este participante ya ha sido guardado como ganador esta semana.");
        } else {
            console.error("Error guardando ganador:", error);
            alert("Error al guardar ganador. Revisa la consola.");
        }
        return;
      }

      // Si se guardó con éxito, recargamos la lista de ganadores y limpiamos el ganador actual
      alert("¡Ganador Oficial Guardado Exitosamente!");
      fetchSavedWinners(campaign.id);
      setWinner(null);

    } catch (err) {
      console.error(err);
    } finally {
      setSavingWinner(false);
    }
  }

  // --- ELIMINAR GANADOR GUARDADO (Por si hay un error) ---
  const removeSavedWinner = async (winnerRecordId: string) => {
      if(!confirm("¿Estás seguro de eliminar a este participante de la lista de ganadores oficiales de esta semana?")) return;
      
      const { error } = await supabase
        .from('raffle_winners')
        .delete()
        .eq('id', winnerRecordId);

      if (error) {
          console.error("Error eliminando:", error);
          alert("Hubo un error al eliminar.");
      } else {
          // Recargamos la lista
          fetchSavedWinners(campaign.id);
      }
  }

  const exportToExcel = () => {
    const listToExport = filteredRegistrations.length > 0 ? filteredRegistrations : registrations;

    if (listToExport.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const dataToExport = listToExport.map(reg => ({
      'Participante': reg.full_name,
      'Teléfono': reg.phone,
      'Email': reg.email,
      'Fecha de Registro': new Date(reg.created_at).toLocaleDateString('es-PE') + ' ' + new Date(reg.created_at).toLocaleTimeString('es-PE'),
      'Voucher (URL)': reg.voucher_url
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registros");

    const fileName = `${TARGET_CAMPAIGN_NAME}_${activeGiveaway.label.replace(/ /g, '_').replace(/\//g, '-')}${searchTerm ? '_Filtrado' : ''}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  if (authChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950"><Loader2 className="animate-spin text-blue-600" /></div>
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2rem] p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Lock size={32} />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-zinc-900 dark:text-zinc-100">Acceso Privado</h1>
            <p className="text-zinc-500 text-sm font-medium mt-1">Panel de control de sorteos</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Usuario</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-zinc-900 dark:text-zinc-100"
                  placeholder="Ingresa tu usuario"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-zinc-900 dark:text-zinc-100"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {loginError && (
              <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl text-xs font-bold">
                <AlertCircle size={14} />
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-6 bg-blue-600 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-colors active:scale-[0.98]"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-4 md:p-8">
      
      <style jsx global>{`
        .thin-scrollbar::-webkit-scrollbar { height: 3px; width: 4px; }
        .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .thin-scrollbar::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 10px; }
        .dark .thin-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }
      `}</style>

      <div className="max-w-6xl mx-auto relative">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div className="space-y-1">
            <Link href="/admin" className="text-xs font-bold text-zinc-400 flex items-center gap-1 hover:text-blue-500 transition-colors mb-2">
              <ArrowLeft size={14} /> VOLVER AL PANEL PRINCIPAL
            </Link>
            <h1 className="text-4xl font-black uppercase tracking-tighter">
              Sorteos: <span className="text-blue-600">{TARGET_CAMPAIGN_NAME}</span>
            </h1>
            <p className="text-zinc-500 text-sm font-medium">Gestión exclusiva para la campaña activa.</p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Campaña Activa</span>
            </div>
            
            <button 
              onClick={() => {
                sessionStorage.removeItem('admin_auth')
                setIsAuthenticated(false)
              }}
              className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </header>

        {loading && !campaign ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="font-bold text-zinc-400 uppercase tracking-widest text-xs">Cargando Campaña...</p>
          </div>
        ) : campaign ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* --- SLIDER DE FECHAS ESTILIZADO --- */}
            <div className="relative w-full">
              <div className="flex gap-2 overflow-x-auto pb-4 pt-1 thin-scrollbar snap-x cursor-grab active:cursor-grabbing">
                {GIVEAWAY_SCHEDULE.map((g) => (
                  <button
                    key={g.label}
                    onClick={() => setActiveGiveaway(g)}
                    className={`px-7 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all duration-300 snap-start shrink-0 ${
                      activeGiveaway.label === g.label 
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg scale-105' 
                      : 'bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-center items-center text-center">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-3xl flex items-center justify-center mb-4">
                  <Users size={32} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Registrados en el periodo</p>
                <p className="text-5xl font-black tracking-tighter">{registrations.length}</p>
              </div>

              {/* CARD DE SORTEO Y VALIDACIÓN */}
              <div className="lg:col-span-2 bg-zinc-900 dark:bg-white p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                <div className="flex-1 space-y-4 z-10 text-center md:text-left flex flex-col justify-between h-full">
                  <div>
                      <h3 className="text-blue-400 dark:text-blue-600 font-black text-sm uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                        <Trophy size={16} /> Ganador de la Semana
                      </h3>
                      {winner ? (
                        <div className="animate-in zoom-in duration-500 mt-4">
                          <p className="text-white dark:text-black text-3xl font-black uppercase tracking-tighter leading-none mb-2">{winner.full_name}</p>
                          <p className="text-zinc-400 dark:text-zinc-500 font-bold text-sm tracking-widest">{winner.phone} </p>
                          
                          {/* BOTÓN PARA GUARDAR OFICIALMENTE */}
                          <button 
                            onClick={saveWinnerOfficial}
                            disabled={savingWinner}
                            className="mt-6 bg-green-500 text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mx-auto md:mx-0 w-full sm:w-auto"
                          >
                            {savingWinner ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                            Confirmar y Guardar Ganador
                          </button>
                        </div>
                      ) : (
                        <p className="text-zinc-500 text-lg font-bold italic mt-4">¿Quién será el afortunado hoy?</p>
                      )}
                  </div>

                  <button 
                    onClick={pickRandomWinner}
                    disabled={filteredRegistrations.length === 0}
                    className="mt-4 bg-white dark:bg-black text-black dark:text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all active:scale-95 disabled:opacity-30"
                  >
                    {winner ? 'Sortear de Nuevo (Descartar)' : 'Realizar Sorteo'}
                  </button>
                </div>

                {winner && (
                  <div className="w-full md:w-48 h-48 bg-white/10 dark:bg-black/5 rounded-[2rem] overflow-hidden border border-white/10 dark:border-black/5 z-10 relative group">
                    <img src={winner.voucher_url} className="w-full h-full object-cover" alt="Voucher ganador" />
                    
                    <button 
                        onClick={() => {
                          setSelectedVoucher(winner.voucher_url);
                          setIsZoomed(false);
                        }}
                        className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                    >
                        <ZoomIn size={24} className="mb-2"/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Validar Foto</span>
                    </button>
                  </div>
                )}
                <Trophy size={150} className="absolute -bottom-10 -right-10 text-white/5 dark:text-black/5 -rotate-12" />
              </div>
            </div>

            {/* --- LISTA DE GANADORES GUARDADOS (NUEVO BLOQUE) --- */}
            {savedWinners.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-[2.5rem] p-8 mt-6">
                    <h3 className="font-black uppercase tracking-tighter text-xl text-amber-900 dark:text-amber-100 mb-6 flex items-center gap-2">
                        <CheckCircle2 className="text-green-500" />
                        Ganadores Confirmados ({activeGiveaway.label})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {savedWinners.map((w, idx) => (
                            <div key={w.winner_record_id} className="bg-white dark:bg-zinc-900 p-5 rounded-[1.5rem] shadow-sm border border-amber-100 dark:border-amber-800/50 flex flex-col justify-between group">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Ganador #{idx + 1}</p>
                                        <p className="font-black text-sm uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{w.full_name}</p>
                                        <p className="text-xs text-zinc-500 font-bold mt-1">{w.phone}</p>
                                    </div>
                                    <button 
                                      onClick={() => removeSavedWinner(w.winner_record_id)}
                                      className="text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Descartar Ganador Oficial"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <button 
                                    onClick={() => {
                                        setSelectedVoucher(w.voucher_url);
                                        setIsZoomed(false);
                                    }}
                                    className="w-full text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50 dark:bg-black py-2 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                >
                                    Ver Voucher Guardado
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- DISCLAIMER --- */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-blue-800 dark:text-blue-200 mt-6">
              <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-2xl shrink-0">
                <AlertCircle size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-black uppercase tracking-widest text-[11px] opacity-80 mb-1">Flujo de Seguridad</h4>
                <p className="text-sm font-bold">
                  Haz clic en "Realizar Sorteo". Valida la foto del voucher del candidato. Si es correcto, haz clic en <span className="font-black bg-green-500/20 px-1 rounded">Confirmar y Guardar Ganador</span>. Si es inválido, vuelve a sortear.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-zinc-50 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-50/50 dark:bg-zinc-800/20">
                <h3 className="font-black uppercase tracking-tighter text-xl">Registros del Periodo</h3>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar por Teléfono o Email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)} 
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>

                  <button 
                    onClick={exportToExcel}
                    disabled={filteredRegistrations.length === 0}
                    className="flex items-center justify-center gap-2 text-xs font-black border-2 border-green-600 rounded-xl py-2 px-4 hover:bg-green-600 hover:text-white uppercase tracking-widest text-green-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                  >
                    <Download size={16} /> Exportar
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto thin-scrollbar max-h-[500px]">
                <table className="w-full text-left border-collapse relative">
                  <thead className="sticky top-0 bg-zinc-50/90 dark:bg-black/90 backdrop-blur-sm text-[10px] font-black uppercase tracking-widest text-zinc-400 z-10 shadow-sm">
                    <tr>
                      <th className="px-8 py-4">Participante</th>
                      <th className="px-8 py-4">Contacto</th>
                      <th className="px-8 py-4">Fecha</th>
                      <th className="px-8 py-4">Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="py-20 text-center">
                          <Loader2 className="animate-spin mx-auto text-zinc-300" size={40} />
                        </td>
                      </tr>
                    ) : filteredRegistrations.length === 0 ? ( 
                      <tr>
                        <td colSpan={4} className="py-20 text-center space-y-4">
                          <AlertCircle size={48} className="mx-auto text-zinc-200" />
                          <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                            {searchTerm ? 'No se encontraron resultados para la búsqueda.' : 'No hay registros.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredRegistrations.map((reg) => (
                        <tr key={reg.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                          <td className="px-8 py-5 font-black text-sm uppercase">{reg.full_name}</td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">{reg.phone}</span>
                              <span className="text-[10px] text-zinc-400 font-medium lowercase">{reg.email}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-xs font-bold text-zinc-400">
                            {new Date(reg.created_at).toLocaleDateString('es-PE')}
                          </td>
                          <td className="px-8 py-3">
                            <button 
                              onClick={() => {
                                setSelectedVoucher(reg.voucher_url);
                                setIsZoomed(false); 
                              }}
                              className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm hover:ring-2 hover:ring-blue-500 transition-all group/thumb"
                            >
                              <img 
                                src={reg.voucher_url} 
                                alt="Miniatura de voucher" 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 flex items-center justify-center transition-colors">
                                <ZoomIn size={18} className="text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          <div className="py-40 text-center">
            <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />
            <p className="font-black uppercase">Error: Campaña "{TARGET_CAMPAIGN_NAME}" no encontrada en la base de datos.</p>
          </div>
        )}
      </div>

      {/* --- MODAL PARA VER/ZOOM EL VOUCHER --- */}
      {selectedVoucher && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-hidden"
          onClick={() => {
            setSelectedVoucher(null);
            setIsZoomed(false);
          }}
        >
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedVoucher(null);
              setIsZoomed(false);
            }}
            className="absolute top-4 right-4 md:top-8 md:right-8 p-3 bg-white/10 hover:bg-red-600 text-white rounded-full transition-colors z-[110]"
          >
            <X size={24} />
          </button>

          <div className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-white/50 text-[10px] font-black tracking-widest uppercase z-[110] pointer-events-none">
            {isZoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
            <span className="hidden sm:inline">Clic en la imagen para {isZoomed ? 'alejar' : 'acercar'}</span>
          </div>

          <div 
            className={`relative transition-transform duration-300 ease-out cursor-pointer ${
              isZoomed ? 'scale-150 md:scale-[2]' : 'scale-100 max-w-full max-h-full'
            }`}
            onClick={(e) => {
              e.stopPropagation(); 
              setIsZoomed(!isZoomed); 
            }}
          >
            <img 
              src={selectedVoucher} 
              alt="Voucher Ampliado" 
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

    </div>
  )
}