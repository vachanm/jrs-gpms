import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from './supabase'
import { logActivity } from './auditLogger'

const ADMIN_USERS = ['Mahendra Sannappa', 'Pratik Shah', 'Sanket Patel', 'Sachin Shah']

// ── Countries & States ────────────────────────────────────────────────────────
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria',
  'Bangladesh','Belgium','Brazil','Canada','Chile','China','Colombia',
  'Croatia','Czech Republic','Denmark','Egypt','Ethiopia','Finland',
  'France','Germany','Ghana','Greece','Hungary','India','Indonesia',
  'Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya',
  'Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria',
  'Norway','Pakistan','Philippines','Poland','Portugal','Romania',
  'Russia','Saudi Arabia','Singapore','South Africa','South Korea',
  'Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand',
  'Turkey','Ukraine','United Arab Emirates','United Kingdom',
  'United States','Vietnam',
]

const STATES_BY_COUNTRY = {
  'United States': [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
    'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
    'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
    'Maine','Maryland','Massachusetts','Michigan','Minnesota',
    'Mississippi','Missouri','Montana','Nebraska','Nevada',
    'New Hampshire','New Jersey','New Mexico','New York',
    'North Carolina','North Dakota','Ohio','Oklahoma','Oregon',
    'Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington',
    'West Virginia','Wisconsin','Wyoming',
  ],
  'India': [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
    'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya',
    'Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim',
    'Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand',
    'West Bengal','Delhi','Jammu & Kashmir','Ladakh',
  ],
  'Australia': [
    'New South Wales','Victoria','Queensland','Western Australia',
    'South Australia','Tasmania','Australian Capital Territory',
    'Northern Territory',
  ],
  'Canada': [
    'Alberta','British Columbia','Manitoba','New Brunswick',
    'Newfoundland and Labrador','Northwest Territories','Nova Scotia',
    'Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon',
  ],
  'United Kingdom': ['England','Scotland','Wales','Northern Ireland'],
  'Germany': [
    'Baden-Württemberg','Bavaria','Berlin','Brandenburg','Bremen',
    'Hamburg','Hesse','Lower Saxony','Mecklenburg-Vorpommern',
    'North Rhine-Westphalia','Rhineland-Palatinate','Saarland',
    'Saxony','Saxony-Anhalt','Schleswig-Holstein','Thuringia',
  ],
  'China': [
    'Anhui','Beijing','Chongqing','Fujian','Gansu','Guangdong','Guangxi',
    'Guizhou','Hainan','Hebei','Heilongjiang','Henan','Hubei','Hunan',
    'Inner Mongolia','Jiangsu','Jiangxi','Jilin','Liaoning','Ningxia',
    'Qinghai','Shaanxi','Shandong','Shanghai','Shanxi','Sichuan',
    'Tianjin','Tibet','Xinjiang','Yunnan','Zhejiang',
  ],
  'France': [
    'Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Brittany',
    'Centre-Val de Loire','Corsica','Grand Est','Hauts-de-France',
    'Île-de-France','Normandy','Nouvelle-Aquitaine','Occitanie',
    'Pays de la Loire',"Provence-Alpes-Côte d'Azur",
  ],
  'Netherlands': [
    'Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg',
    'North Brabant','North Holland','Overijssel','South Holland','Utrecht','Zeeland',
  ],
  'Belgium': ['Brussels','Flanders','Wallonia'],
  'Spain': [
    'Andalusia','Aragon','Asturias','Balearic Islands','Basque Country',
    'Canary Islands','Cantabria','Castile and León','Castile-La Mancha',
    'Catalonia','Extremadura','Galicia','La Rioja','Madrid','Murcia','Navarra','Valencia',
  ],
  'Italy': [
    'Abruzzo','Aosta Valley','Apulia','Basilicata','Calabria','Campania',
    'Emilia-Romagna','Friuli Venezia Giulia','Lazio','Liguria','Lombardy',
    'Marche','Molise','Piedmont','Sardinia','Sicily','Trentino-South Tyrol',
    'Tuscany','Umbria','Veneto',
  ],
  'Switzerland': [
    'Aargau','Basel-Landschaft','Basel-Stadt','Bern','Fribourg','Geneva',
    'Glarus','Graubünden','Jura','Lucerne','Neuchâtel','Nidwalden','Obwalden',
    'Schaffhausen','Schwyz','Solothurn','St. Gallen','Thurgau','Ticino',
    'Uri','Valais','Vaud','Zug','Zurich',
  ],
  'South Korea': [
    'Busan','Daegu','Daejeon','Gangwon-do','Gwangju','Gyeonggi-do',
    'Gyeongsangbuk-do','Gyeongsangnam-do','Incheon','Jeju','Jeollabuk-do',
    'Jeollanam-do','Sejong','Seoul','Ulsan',
  ],
  'Japan': [
    'Aichi','Akita','Aomori','Chiba','Ehime','Fukui','Fukuoka','Fukushima',
    'Gifu','Gunma','Hiroshima','Hokkaido','Hyogo','Ibaraki','Ishikawa',
    'Iwate','Kagawa','Kagoshima','Kanagawa','Kochi','Kumamoto','Kyoto',
    'Mie','Miyagi','Miyazaki','Nagano','Nagasaki','Nara','Niigata','Oita',
    'Okayama','Okinawa','Osaka','Saga','Saitama','Shiga','Shimane',
    'Shizuoka','Tochigi','Tokushima','Tokyo','Tottori','Toyama','Wakayama',
    'Yamagata','Yamaguchi','Yamanashi',
  ],
  'Malaysia': [
    'Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Malacca',
    'Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya',
    'Sabah','Sarawak','Selangor','Terengganu',
  ],
  'Indonesia': [
    'Aceh','Bali','Bangka Belitung','Banten','Bengkulu','Central Java',
    'Central Kalimantan','Central Sulawesi','East Java','East Kalimantan',
    'East Nusa Tenggara','Gorontalo','Jakarta','Jambi','Lampung','Maluku',
    'North Kalimantan','North Maluku','North Sulawesi','North Sumatra',
    'Papua','Riau','Riau Islands','South Kalimantan','South Sulawesi',
    'South Sumatra','Southeast Sulawesi','West Java','West Kalimantan',
    'West Nusa Tenggara','West Papua','West Sulawesi','West Sumatra',
    'Yogyakarta',
  ],
  'Brazil': [
    'Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal',
    'Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul',
    'Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí',
    'Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia',
    'Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins',
  ],
  'Mexico': [
    'Aguascalientes','Baja California','Baja California Sur','Campeche',
    'Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango',
    'Guanajuato','Guerrero','Hidalgo','Jalisco','México','Michoacán',
    'Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
    'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco',
    'Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas',
  ],
}

const CITIES_BY_COUNTRY = {
  'Afghanistan': ['Kabul','Kandahar','Herat','Mazar-i-Sharif','Jalalabad'],
  'Albania': ['Tirana','Durrës','Vlorë','Shkodër','Fier'],
  'Algeria': ['Algiers','Oran','Constantine','Annaba','Blida'],
  'Argentina': ['Buenos Aires','Córdoba','Rosario','Mendoza','La Plata','Mar del Plata','Tucumán','Salta'],
  'Australia': ['Sydney','Melbourne','Brisbane','Perth','Adelaide','Gold Coast','Canberra','Newcastle','Hobart'],
  'Austria': ['Vienna','Graz','Linz','Salzburg','Innsbruck','Klagenfurt'],
  'Bangladesh': ['Dhaka','Chittagong','Khulna','Rajshahi','Sylhet','Comilla'],
  'Belgium': ['Brussels','Antwerp','Ghent','Bruges','Liège','Leuven'],
  'Brazil': ['São Paulo','Rio de Janeiro','Brasília','Salvador','Fortaleza','Belo Horizonte','Manaus','Curitiba','Porto Alegre'],
  'Canada': ['Toronto','Montreal','Vancouver','Calgary','Edmonton','Ottawa','Winnipeg','Quebec City','Hamilton'],
  'Chile': ['Santiago','Valparaíso','Concepción','La Serena','Antofagasta','Temuco'],
  'China': ['Beijing','Shanghai','Guangzhou','Shenzhen','Chengdu','Hangzhou','Wuhan','Xi\'an','Nanjing','Tianjin','Chongqing','Suzhou'],
  'Colombia': ['Bogotá','Medellín','Cali','Barranquilla','Cartagena','Cúcuta'],
  'Croatia': ['Zagreb','Split','Rijeka','Osijek','Zadar'],
  'Czech Republic': ['Prague','Brno','Ostrava','Plzeň','Liberec'],
  'Denmark': ['Copenhagen','Aarhus','Odense','Aalborg','Esbjerg'],
  'Egypt': ['Cairo','Alexandria','Giza','Luxor','Aswan','Sharm el-Sheikh'],
  'Ethiopia': ['Addis Ababa','Dire Dawa','Mekelle','Gondar','Hawassa'],
  'Finland': ['Helsinki','Espoo','Tampere','Vantaa','Oulu','Turku'],
  'France': ['Paris','Lyon','Marseille','Toulouse','Nice','Nantes','Bordeaux','Strasbourg','Lille','Rennes'],
  'Germany': ['Berlin','Hamburg','Munich','Cologne','Frankfurt','Stuttgart','Düsseldorf','Leipzig','Dortmund','Bremen'],
  'Ghana': ['Accra','Kumasi','Tamale','Sekondi-Takoradi','Cape Coast'],
  'Greece': ['Athens','Thessaloniki','Patras','Heraklion','Larissa'],
  'Hungary': ['Budapest','Debrecen','Miskolc','Szeged','Pécs'],
  'India': ['Mumbai','Delhi','Bengaluru','Hyderabad','Ahmedabad','Chennai','Kolkata','Pune','Jaipur','Surat','Lucknow','Kanpur','Nagpur','Indore','Bhopal','Visakhapatnam','Coimbatore','Vadodara','Gurgaon','Noida'],
  'Indonesia': ['Jakarta','Surabaya','Bandung','Medan','Semarang','Makassar','Palembang','Tangerang','Depok','Bekasi'],
  'Iran': ['Tehran','Mashhad','Isfahan','Karaj','Tabriz','Shiraz'],
  'Iraq': ['Baghdad','Basra','Mosul','Erbil','Kirkuk','Najaf'],
  'Ireland': ['Dublin','Cork','Limerick','Galway','Waterford'],
  'Israel': ['Jerusalem','Tel Aviv','Haifa','Rishon LeZion','Petah Tikva','Ashdod'],
  'Italy': ['Rome','Milan','Naples','Turin','Palermo','Genoa','Bologna','Florence','Venice','Bari'],
  'Japan': ['Tokyo','Osaka','Nagoya','Sapporo','Fukuoka','Kobe','Kyoto','Yokohama','Hiroshima','Sendai'],
  'Jordan': ['Amman','Zarqa','Irbid','Aqaba','Madaba'],
  'Kenya': ['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret'],
  'Malaysia': ['Kuala Lumpur','George Town','Ipoh','Shah Alam','Johor Bahru','Malacca','Kota Kinabalu','Kuching'],
  'Mexico': ['Mexico City','Guadalajara','Monterrey','Puebla','Tijuana','León','Juárez','Zapopan','Mérida'],
  'Morocco': ['Casablanca','Rabat','Fes','Marrakech','Tangier','Agadir'],
  'Netherlands': ['Amsterdam','Rotterdam','The Hague','Utrecht','Eindhoven','Tilburg','Groningen'],
  'New Zealand': ['Auckland','Wellington','Christchurch','Hamilton','Tauranga','Dunedin'],
  'Nigeria': ['Lagos','Kano','Ibadan','Abuja','Port Harcourt','Benin City','Kaduna'],
  'Norway': ['Oslo','Bergen','Trondheim','Stavanger','Tromsø'],
  'Pakistan': ['Karachi','Lahore','Faisalabad','Rawalpindi','Islamabad','Multan','Peshawar','Quetta'],
  'Philippines': ['Manila','Quezon City','Cebu','Davao','Zamboanga','Taguig','Antipolo'],
  'Poland': ['Warsaw','Kraków','Wrocław','Gdańsk','Poznań','Szczecin','Łódź'],
  'Portugal': ['Lisbon','Porto','Braga','Setúbal','Coimbra','Funchal'],
  'Romania': ['Bucharest','Cluj-Napoca','Timișoara','Iași','Brașov','Constanța'],
  'Russia': ['Moscow','Saint Petersburg','Novosibirsk','Yekaterinburg','Kazan','Nizhny Novgorod','Vladivostok'],
  'Saudi Arabia': ['Riyadh','Jeddah','Mecca','Medina','Dammam','Khobar','Tabuk'],
  'Singapore': ['Singapore'],
  'South Africa': ['Johannesburg','Cape Town','Durban','Pretoria','Port Elizabeth','Bloemfontein'],
  'South Korea': ['Seoul','Busan','Incheon','Daegu','Daejeon','Gwangju','Suwon'],
  'Spain': ['Madrid','Barcelona','Valencia','Seville','Zaragoza','Málaga','Bilbao','Alicante'],
  'Sri Lanka': ['Colombo','Kandy','Galle','Jaffna','Negombo','Trincomalee'],
  'Sweden': ['Stockholm','Gothenburg','Malmö','Uppsala','Västerås','Örebro'],
  'Switzerland': ['Zurich','Geneva','Basel','Bern','Lausanne','Winterthur','Lucerne'],
  'Taiwan': ['Taipei','Kaohsiung','Taichung','Tainan','Hsinchu','Keelung'],
  'Thailand': ['Bangkok','Chiang Mai','Phuket','Pattaya','Chonburi','Khon Kaen'],
  'Turkey': ['Istanbul','Ankara','Izmir','Bursa','Antalya','Adana','Gaziantep'],
  'Ukraine': ['Kyiv','Kharkiv','Odessa','Dnipro','Lviv','Zaporizhzhia'],
  'United Arab Emirates': ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah'],
  'United Kingdom': ['London','Birmingham','Manchester','Glasgow','Leeds','Liverpool','Bristol','Sheffield','Edinburgh','Cardiff'],
  'United States': ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','San Jose','Austin','Jacksonville','Fort Worth','Columbus','Charlotte','Indianapolis','San Francisco','Seattle','Denver','Nashville','Boston','Washington DC','Las Vegas','Portland','Miami','Atlanta'],
  'Vietnam': ['Ho Chi Minh City','Hanoi','Da Nang','Hai Phong','Can Tho','Nha Trang'],
}

// ── Master config (vendors / products / storage) ──────────────────────────────
const MASTERS = {
  vendors: {
    label: 'Supplier Master',
    table: 'vendors_master',
    color: 'text-purple-600 bg-purple-50',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    fields: [
      { key: 'name', label: 'Supplier Name', required: true, placeholder: 'e.g. Global Supplies Inc' },
    ],
    columns: [
      { label: 'Supplier Name', key: 'name', sortable: 'name' },
      { label: 'Added', key: 'created_at', format: 'date', sortable: 'created_at' },
    ],
  },
  products: {
    label: 'Product Master',
    table: 'products_master',
    color: 'text-emerald-600 bg-emerald-50',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    fields: [
      { key: 'name',         label: 'Product Name',  required: true,  placeholder: 'e.g. Paracetamol 500mg' },
      { key: 'ndc_ma_code',  label: 'NDC / MA Code', required: false, placeholder: 'e.g. NDC 12345-678' },
      { key: 'manufacturer', label: 'Manufacturer',  required: false, placeholder: 'e.g. Bayer AG' },
    ],
    columns: [
      { label: 'Product Name',  key: 'name',        sortable: 'name' },
      { label: 'NDC / MA Code', key: 'ndc_ma_code' },
      { label: 'Manufacturer',  key: 'manufacturer' },
      { label: 'Added',         key: 'created_at',  format: 'date', sortable: 'created_at' },
    ],
  },
  storage: {
    label: 'Storage Master',
    table: 'storage_master',
    color: 'text-amber-600 bg-amber-50',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
    fields: [
      { key: 'name',     label: 'Storage Name', required: true,  placeholder: 'e.g. Warehouse A' },
      { key: 'location', label: 'Location',     required: false, placeholder: 'e.g. Amsterdam, NL' },
    ],
    columns: [
      { label: 'Storage Name', key: 'name',       sortable: 'name' },
      { label: 'Location',     key: 'location' },
      { label: 'Added',        key: 'created_at', format: 'date', sortable: 'created_at' },
    ],
  },
}

const TABS = [
  {
    key: 'company', label: 'Company Master',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  },
  {
    key: 'customers', label: 'Customer Master',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  },
  {
    key: 'vendors', label: 'Supplier Master',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  },
  {
    key: 'products', label: 'Product Master',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  },
  {
    key: 'storage', label: 'Storage Master',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
    const day = String(d.getDate()).padStart(2, '0')
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
    return `${day}/${mon}/${d.getFullYear()}`
  } catch { return iso }
}

function applySortRows(rows, field, dir) {
  return [...rows].sort((a, b) => {
    const av = a[field] ?? ''
    const bv = b[field] ?? ''
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
}

function SortIcon({ field, sortField, sortDir }) {
  const active = sortField === field
  return (
    <span className="ml-1 inline-flex flex-col gap-[1px] align-middle">
      <svg className={`w-3 h-3 ${active && sortDir === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16z" /></svg>
      <svg className={`w-3 h-3 ${active && sortDir === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4z" /></svg>
    </span>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [toast, onDismiss])
  if (!toast) return null
  return (
    <div className={`fixed top-5 right-5 z-[200] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium pointer-events-none select-none
      ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.type === 'success'
        ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>}
      {toast.message}
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({ displayName, masterLabel, onConfirm, onCancel }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [onCancel])
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-center text-gray-900 mb-1">Delete Entry</h3>
        <p className="text-gray-500 text-sm text-center mb-6">
          Remove <span className="font-semibold text-gray-800">{displayName}</span> from {masterLabel}?
          <br />This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-medium transition">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Shared field components ───────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

const inputCls = err =>
  `w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition
   ${err ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'}`

const selectCls = err =>
  `w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition bg-white
   ${err ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'}`

// ── Remarks tooltip (portal) ─────────────────────────────────────────────────
function RemarksCell({ text }) {
  const [tooltip, setTooltip] = useState(null)

  if (!text) return <span style={{ color: '#cbd5e1' }}>—</span>

  function handleMouseEnter(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ top: rect.bottom + 8, left: rect.left })
  }

  return (
    <>
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltip(null)}
        style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default', maxWidth: 160 }}
      >
        {text}
      </span>
      {tooltip && createPortal(
        <div style={{
          position: 'fixed',
          top: tooltip.top,
          left: tooltip.left,
          zIndex: 99999,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '12px',
          maxWidth: 300,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          fontSize: 13,
          color: '#374151',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          pointerEvents: 'none',
        }}>
          {text}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Code generators ───────────────────────────────────────────────────────────
// ── Country prefix maps ───────────────────────────────────────────────────────
const CUSTOMER_PREFIX = {
  'Canada': 'CCA', 'United States': 'CUS', 'China': 'CCN', 'India': 'CIN',
  'Germany': 'CDE', 'Netherlands': 'CNL', 'South Korea': 'CSK',
  'South Africa': 'CSA', 'Russia': 'CRS', 'Indonesia': 'CID',
  'Malaysia': 'CML', 'Australia': 'CAU', 'New Zealand': 'CNZ',
  'Brazil': 'CBR', 'Mexico': 'CMX', 'Japan': 'CJP', 'France': 'CFR',
  'United Kingdom': 'CUK', 'Spain': 'CES', 'Italy': 'CIT',
  'Belgium': 'CBE', 'Switzerland': 'CCH', 'Singapore': 'CSG',
}
const SUPPLIER_PREFIX = {
  'Canada': 'SCA', 'United States': 'SUS', 'China': 'SCN', 'India': 'SIN',
  'Germany': 'SDE', 'Netherlands': 'SNL', 'South Korea': 'SSK',
  'South Africa': 'SSA', 'Russia': 'SRS', 'Indonesia': 'SID',
  'Malaysia': 'SML', 'Australia': 'SAU', 'New Zealand': 'SNZ',
  'Brazil': 'SBR', 'Mexico': 'SMX', 'Japan': 'SJP', 'France': 'SFR',
  'United Kingdom': 'SUK', 'Spain': 'SES', 'Italy': 'SIT',
  'Belgium': 'SBE', 'Switzerland': 'SCH', 'Singapore': 'SSG',
}
const COUNTRY_ISO2 = {
  'United States': 'US', 'Canada': 'CA', 'Brazil': 'BR', 'India': 'IN',
  'China': 'CN', 'Germany': 'DE', 'Netherlands': 'NL', 'South Korea': 'KR',
  'South Africa': 'ZA', 'Russia': 'RU', 'Indonesia': 'ID', 'Malaysia': 'MY',
  'Australia': 'AU', 'New Zealand': 'NZ', 'Mexico': 'MX', 'Japan': 'JP',
  'United Kingdom': 'UK', 'France': 'FR', 'Spain': 'ES', 'Italy': 'IT',
  'Belgium': 'BE', 'Switzerland': 'CH', 'Singapore': 'SG',
}

// ── Material Types ────────────────────────────────────────────────────────────
const MATERIAL_TYPES = [
  { label: 'Product',                 code: 'PR' },
  { label: 'Equipment',               code: 'EQ' },
  { label: 'Ancillary',               code: 'AN' },
  { label: 'Labels',                  code: 'LB' },
  { label: 'Bulk',                    code: 'BK' },
  { label: 'Services',                code: 'SR' },
  { label: 'Package',                 code: 'PK' },
  { label: 'Cartons',                 code: 'CT' },
  { label: 'Logistics',               code: 'LG' },
  { label: 'Asset',                   code: 'AS' },
  { label: 'Warehouse',               code: 'WH' },
  { label: 'Clinical Trial Material', code: 'TM' },
]

// ── Units of Measurement ──────────────────────────────────────────────────────
const UNITS_OF_MEASUREMENT = [
  { label: 'Each',             code: 'each' },
  { label: 'Syringe',         code: 'Syr'  },
  { label: 'Ampoules',        code: 'amps' },
  { label: 'Vials',           code: 'vial' },
  { label: 'Prefilled Syringe', code: 'PFS' },
  { label: 'Prefilled PEN',   code: 'PFP'  },
  { label: 'Cartridge',       code: 'Cart' },
  { label: 'Packs',           code: 'pack' },
]

async function nextSeqNum(table, codeField, prefix, company) {
  const { data } = await supabase.from(table).select(codeField).eq('company', company)
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\d+)$`)
  const nums = (data || []).map(r => r[codeField]).filter(Boolean)
    .map(c => { const m = c.match(re); return m ? parseInt(m[1], 10) : null }).filter(n => n !== null)
  return nums.length > 0 ? Math.max(...nums) + 1 : 10001
}

async function generateCustomerCode(country, company) {
  const { data } = await supabase.from('code_formats').select('prefix').eq('type', 'customer').eq('country', country).eq('company', company).maybeSingle()
  const prefix = data?.prefix || CUSTOMER_PREFIX[country] || 'CXX'
  const seq = await nextSeqNum('customers_master', 'customer_code', prefix, company)
  return `${prefix} ${seq}`
}

async function generateSupplierCode(country, company) {
  const { data } = await supabase.from('code_formats').select('prefix').eq('type', 'supplier').eq('country', country).eq('company', company).maybeSingle()
  const prefix = data?.prefix || SUPPLIER_PREFIX[country] || 'SXX'
  const seq = await nextSeqNum('vendors_master', 'supplier_code', prefix, company)
  return `${prefix} ${seq}`
}

async function generateProductCode(country, materialType, company) {
  const { data } = await supabase.from('code_formats').select('prefix').eq('type', 'product').eq('country', country).eq('company', company).maybeSingle()
  const iso = data?.prefix || COUNTRY_ISO2[country] || 'XX'
  const mt = MATERIAL_TYPES.find(m => m.label === materialType)
  const typeCode = mt ? mt.code : 'PR'
  const prefix = `${iso}${typeCode}`
  const seq = await nextSeqNum('products_master', 'product_code', prefix, company)
  return `${prefix} ${seq}`
}

// ── Approval Badge (inline dropdown) ─────────────────────────────────────────
function ApprovalBadge({ entry, onToggle }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const fn = e => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  function handleOpen() {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
    setOpen(v => !v)
  }

  async function select(val) {
    setOpen(false)
    if (val === entry.is_approved) return
    setLoading(true)
    await onToggle(entry.id, val)
    setLoading(false)
  }

  const approved = entry.is_approved

  return (
    <div ref={ref} style={{ display: 'inline-block' }}>
      <button
        onClick={handleOpen}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer select-none transition
          ${approved ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'}`}
      >
        {loading
          ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
          : <span className={`w-1.5 h-1.5 rounded-full ${approved ? 'bg-emerald-500' : 'bg-amber-500'}`} />}
        {approved ? 'Approved' : 'Unapproved'}
        <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 99999,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: 140,
            overflow: 'hidden',
          }}
        >
          {[
            { val: true,  label: 'Approved',   cls: 'text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' },
            { val: false, label: 'Unapproved', cls: 'text-amber-700 bg-amber-50',   dot: 'bg-amber-500'   },
          ].map(({ val, label, cls, dot }) => (
            <button
              key={String(val)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(val)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition hover:opacity-80 ${val === approved ? cls : 'hover:bg-gray-50 text-gray-700'}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${val === approved ? dot : 'bg-gray-300'}`} />
              {label}
              {val === approved && (
                <svg className="w-3 h-3 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Customer Section ──────────────────────────────────────────────────────────
const EMPTY_CUSTOMER = {
  name: '',
  customer_code: '',
  bill_to_address: '',
  bill_to_country: '', bill_to_state: '', bill_to_city: '', bill_to_postal_code: '',
  ship_to_address: '',
  ship_to_country: '', ship_to_state: '', ship_to_city: '', ship_to_postal_code: '',
  country: '', state: '', postal_code: '',
  website: '',
  valid_date: '',
  contact1_name: '', contact1_email: '', contact1_phone: '',
  contact2_name: '', contact2_email: '', contact2_phone: '',
  contact3_name: '', contact3_email: '', contact3_phone: '',
  license_number: '',
  license_validity: '',
  is_approved: false,
  approved_date: '',
  bank_name: '', bank_address: '', bank_account_name: '',
  bank_account_number: '', bank_routing_number: '',
  bank_swift: '', bank_iban: '', bank_currency: '',
  remarks: '',
}

// ── Master Import Config ──────────────────────────────────────────────────────
const MASTER_IMPORT_CONFIG = {
  customers_master: {
    label: 'Customer', codeField: 'customer_code', codePrefix: 'CUS',
    fields: [
      { key: 'name',            label: 'Name',             required: true,  aliases: ['name', 'customer name', 'company name', 'customer'] },
      { key: 'bill_to_address', label: 'Bill To Address',  required: false, aliases: ['bill to address', 'billing address', 'bill to', 'bill address'] },
      { key: 'ship_to_address', label: 'Ship To Address',  required: false, aliases: ['ship to address', 'shipping address', 'ship to', 'ship address'] },
      { key: 'country',         label: 'Country',          required: false, aliases: ['country'] },
      { key: 'state',           label: 'State',            required: false, aliases: ['state', 'province'] },
      { key: 'postal_code',     label: 'Postal Code',      required: false, aliases: ['postal code', 'zip', 'postcode', 'zip code'] },
      { key: 'website',         label: 'Website',          required: false, aliases: ['website', 'web', 'url'] },
      { key: 'contact1_name',   label: 'Contact 1 Name',   required: false, aliases: ['contact 1 name', 'contact name', 'primary contact'] },
      { key: 'contact1_email',  label: 'Contact 1 Email',  required: false, aliases: ['contact 1 email', 'email', 'contact email', 'primary email'] },
      { key: 'contact1_phone',  label: 'Contact 1 Phone',  required: false, aliases: ['contact 1 phone', 'phone', 'contact phone', 'primary phone'] },
      { key: 'contact2_name',   label: 'Contact 2 Name',   required: false, aliases: ['contact 2 name', 'secondary contact'] },
      { key: 'contact2_email',  label: 'Contact 2 Email',  required: false, aliases: ['contact 2 email', 'secondary email'] },
      { key: 'contact2_phone',  label: 'Contact 2 Phone',  required: false, aliases: ['contact 2 phone', 'secondary phone'] },
      { key: 'contact3_name',   label: 'Contact 3 Name',   required: false, aliases: ['contact 3 name'] },
      { key: 'contact3_email',  label: 'Contact 3 Email',  required: false, aliases: ['contact 3 email'] },
      { key: 'contact3_phone',  label: 'Contact 3 Phone',  required: false, aliases: ['contact 3 phone'] },
      { key: 'license_number',   label: 'License Number',   required: false, aliases: ['license number', 'license no', 'licence no', 'licence number'] },
      { key: 'license_validity', label: 'License Validity', required: false, aliases: ['license validity', 'licence validity', 'license expiry', 'licence expiry'] },
      { key: 'approved_date',    label: 'Approved Date',    required: false, aliases: ['approved date', 'approval date'] },
      { key: 'remarks',          label: 'Remarks',          required: false, aliases: ['remarks', 'notes', 'comments'] },
    ],
  },
  vendors_master: {
    label: 'Supplier', codeField: null,
    fields: [
      { key: 'name',           label: 'Name',             required: true,  aliases: ['name', 'supplier name', 'vendor name', 'vendor', 'supplier'] },
      { key: 'bill_to_address', label: 'Address',           required: false, aliases: ['address', 'addr', 'street', 'building', 'address 1', 'addr1'] },
      { key: 'bill_to_country', label: 'Country',           required: false, aliases: ['country'] },
      { key: 'bill_to_state',   label: 'State / Province',  required: false, aliases: ['state', 'province'] },
      { key: 'bill_to_city',    label: 'City',              required: false, aliases: ['city'] },
      { key: 'bill_to_postal_code', label: 'Postal Code',   required: false, aliases: ['postal code', 'zip', 'postcode'] },
      { key: 'country',        label: 'Country',          required: false, aliases: ['country'] },
      { key: 'state',          label: 'State',            required: false, aliases: ['state', 'province'] },
      { key: 'postal_code',    label: 'Postal Code',      required: false, aliases: ['postal code', 'zip', 'postcode'] },
      { key: 'website',        label: 'Website',          required: false, aliases: ['website', 'web', 'url'] },
      { key: 'contact1_name',  label: 'Contact 1 Name',   required: false, aliases: ['contact 1 name', 'contact name', 'primary contact'] },
      { key: 'contact1_email', label: 'Contact 1 Email',  required: false, aliases: ['contact 1 email', 'email', 'contact email'] },
      { key: 'contact1_phone', label: 'Contact 1 Phone',  required: false, aliases: ['contact 1 phone', 'phone', 'contact phone'] },
      { key: 'contact2_name',  label: 'Contact 2 Name',   required: false, aliases: ['contact 2 name', 'secondary contact'] },
      { key: 'contact2_email', label: 'Contact 2 Email',  required: false, aliases: ['contact 2 email', 'secondary email'] },
      { key: 'contact2_phone', label: 'Contact 2 Phone',  required: false, aliases: ['contact 2 phone', 'secondary phone'] },
      { key: 'contact3_name',  label: 'Contact 3 Name',   required: false, aliases: ['contact 3 name'] },
      { key: 'contact3_email', label: 'Contact 3 Email',  required: false, aliases: ['contact 3 email'] },
      { key: 'contact3_phone', label: 'Contact 3 Phone',  required: false, aliases: ['contact 3 phone'] },
      { key: 'approved_date',    label: 'Approved Date',    required: false, aliases: ['approved date', 'approval date'] },
      { key: 'valid_through',    label: 'Valid Through',    required: false, aliases: ['valid through', 'valid till', 'expiry', 'expiry date'] },
      { key: 'license_number',   label: 'License Number',   required: false, aliases: ['license number', 'license no', 'licence no', 'licence number'] },
      { key: 'license_validity', label: 'License Validity', required: false, aliases: ['license validity', 'licence validity', 'license expiry', 'licence expiry'] },
      { key: 'remarks',          label: 'Remarks',          required: false, aliases: ['remarks', 'notes'] },
    ],
  },
  products_master: {
    label: 'Product', codeField: 'product_code', codePrefix: 'PRD',
    fields: [
      { key: 'name',              label: 'Name',              required: true,  aliases: ['name', 'product name', 'item name', 'product', 'item'] },
      { key: 'pack_size',         label: 'Pack Size',         required: false, aliases: ['pack size', 'pack', 'packaging', 'size'] },
      { key: 'ndc_ma_code',       label: 'NDC / MA Code',     required: false, aliases: ['ndc ma code', 'ndc', 'ma code', 'ndc/ma', 'national code'] },
      { key: 'country_of_origin', label: 'Country of Origin', required: false, aliases: ['country of origin', 'origin', 'country', 'source country'] },
      { key: 'remarks',           label: 'Remarks',           required: false, aliases: ['remarks', 'notes'] },
    ],
  },
  storage_master: {
    label: 'Storage Location', codeField: null,
    fields: [
      { key: 'name',     label: 'Name',     required: true,  aliases: ['name', 'storage name', 'location name', 'storage'] },
      { key: 'location', label: 'Location', required: false, aliases: ['location', 'address', 'site'] },
    ],
  },
}

// ── Master Import Modal ───────────────────────────────────────────────────────
function MasterImportModal({ file, tableKey, company, onClose, onImported }) {
  const cfg = MASTER_IMPORT_CONFIG[tableKey]
  const [step, setStep]               = useState('parsing')
  const [headers, setHeaders]         = useState([])
  const [rawRows, setRawRows]         = useState([])
  const [mapping, setMapping]         = useState({})
  const [preview, setPreview]         = useState([])
  const [importing, setImporting]     = useState(false)
  const [parseError, setParseError]   = useState('')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  useEffect(() => {
    async function parse() {
      try {
        const buf  = await file.arrayBuffer()
        const wb   = XLSX.read(buf, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (json.length < 2) { setParseError('File appears to be empty.'); setStep('error'); return }
        const rawHeaders = json[0].map(h => String(h).trim()).filter(Boolean)
        const dataRows = json.slice(1)
          .map(row => { const o = {}; rawHeaders.forEach((h, i) => { o[h] = String(row[i] ?? '').trim() }); return o })
          .filter(r => Object.values(r).some(v => v !== ''))
        if (!dataRows.length) { setParseError('No data rows found.'); setStep('error'); return }
        const lh = rawHeaders.map(h => h.toLowerCase().trim())
        const autoMap = {}
        cfg.fields.forEach(f => {
          for (const alias of f.aliases) {
            const idx = lh.indexOf(alias)
            if (idx !== -1) { autoMap[f.key] = rawHeaders[idx]; break }
          }
        })
        setHeaders(rawHeaders); setRawRows(dataRows); setMapping(autoMap); setStep('map')
      } catch { setParseError('Could not read file. Ensure it is a valid .xlsx or .csv.'); setStep('error') }
    }
    parse()
  }, [file])

  function toDateString(val) {
    if (!val) return null
    const n = Number(val)
    if (!isNaN(n) && n > 1000) {
      const d = new Date(Math.round((n - 25569) * 86400 * 1000))
      return d.toISOString().split('T')[0]
    }
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }

  const DATE_FIELDS = ['approved_date', 'valid_through', 'license_validity']

  function buildPreview() {
    return rawRows.map(row => {
      const d = {}
      cfg.fields.forEach(f => { d[f.key] = String(row[mapping[f.key]] || '').trim() })
      const errors = []
      if (!d.name) errors.push('Name is required')
      return { ...d, _errors: errors, _ok: errors.length === 0 }
    })
  }

  async function doImport() {
    setImportError('')
    let toInsert = preview
      .filter(r => r._ok)
      .map(({ _errors, _ok, ...rest }) => {
        const row = { ...rest, company }
        DATE_FIELDS.forEach(f => { if (f in row) row[f] = toDateString(row[f]) || null })
        Object.keys(row).forEach(k => { if (row[k] === '') row[k] = null })
        return row
      })

    if (cfg.codeField) {
      const { data: existing } = await supabase.from(tableKey).select(cfg.codeField).eq('company', company)
      const rx = new RegExp(`^${cfg.codePrefix}-\\d+$`)
      const nums = (existing || []).map(r => r[cfg.codeField]).filter(c => c && rx.test(c)).map(c => parseInt(c.replace(`${cfg.codePrefix}-`, ''), 10))
      let next = nums.length > 0 ? Math.max(...nums) + 1 : 1
      toInsert = toInsert.map(row => ({ ...row, [cfg.codeField]: `${cfg.codePrefix}-${String(next++).padStart(3, '0')}` }))
    }

    setImporting(true)
    const { error } = await supabase.from(tableKey).insert(toInsert)
    setImporting(false)
    if (error) { setImportError(error.message); return }
    onImported(toInsert.length)
  }

  const okCount  = preview.filter(r => r._ok).length
  const errCount = preview.filter(r => !r._ok).length
  const extraCols = cfg.fields.filter(f => f.key !== 'name').slice(0, 2)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import {cfg.label}s from Excel / CSV</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {step === 'map'     && `${rawRows.length} rows found — map your columns`}
              {step === 'preview' && 'Review before importing'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-gray-400 text-sm">Reading file…</p>
            </div>
          )}
          {step === 'error' && (
            <div className="text-center py-16">
              <svg className="w-12 h-12 text-amber-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="font-semibold text-gray-800 mb-1">Could not read file</p>
              <p className="text-gray-400 text-sm">{parseError}</p>
            </div>
          )}
          {step === 'map' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                <strong>{rawRows.length}</strong> rows detected. Map your file's columns to {cfg.label} fields. Fields marked auto-detected were matched automatically.
              </div>
              <div className="grid grid-cols-2 gap-4">
                {cfg.fields.map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      {f.label}
                      {f.required && <span className="text-red-500 ml-1">*</span>}
                      {mapping[f.key]
                        ? <span className="ml-2 text-emerald-600 font-normal normal-case inline-flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            auto-detected
                          </span>
                        : <span className="ml-2 text-amber-500 font-normal normal-case">— not detected</span>}
                    </label>
                    <select className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      value={mapping[f.key] || ''}
                      onChange={e => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}>
                      <option value="">— skip —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{okCount} ready
                </span>
                {errCount > 0 && <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{errCount} will be skipped
                </span>}
              </div>
              <div className="border border-gray-100 rounded-xl overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Status', 'Name', ...extraCols.map(f => f.label), 'Issues'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((row, i) => (
                      <tr key={i} className={!row._ok ? 'bg-red-50/60' : ''}>
                        <td className="px-3 py-2.5">
                          {!row._ok
                            ? <span className="text-red-600 font-medium flex items-center gap-1"><svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>Skip</span>
                            : <span className="text-emerald-600 font-medium flex items-center gap-1"><svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>OK</span>}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">{row.name || <span className="text-red-400 italic">missing</span>}</td>
                        {extraCols.map(f => <td key={f.key} className="px-3 py-2.5 text-gray-500">{row[f.key] || '—'}</td>)}
                        <td className="px-3 py-2.5">{row._errors.map((m, j) => <p key={j} className="text-red-500">{m}</p>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-4 border-t border-gray-100 shrink-0 space-y-3">
          {importError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
              <span className="font-semibold">Import failed: </span>{importError}
            </div>
          )}
          <div className="flex gap-3">
            {step === 'map' && (
              <>
                <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
                <button onClick={() => { setPreview(buildPreview()); setStep('preview') }} disabled={!mapping.name}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition">
                  {!mapping.name ? 'Map the Name column first' : `Preview ${rawRows.length} rows →`}
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button onClick={() => { setStep('map'); setImportError('') }} className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">← Back</button>
                <button onClick={onClose} className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
                <button onClick={doImport} disabled={importing || okCount === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                  {importing && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {importing ? 'Importing…' : okCount === 0 ? 'No valid rows' : `Import ${okCount} ${cfg.label}${okCount !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
            {(step === 'parsing' || step === 'error') && (
              <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Close</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const CUSTOMER_REPORT_COLS = [
  { label: 'Code',              key: 'customer_code' },
  { label: 'Name',              key: 'name' },
  { label: 'Bill To Address',   key: 'bill_to_address' },
  { label: 'Bill Country',      key: 'bill_to_country' },
  { label: 'Bill State',        key: 'bill_to_state' },
  { label: 'Bill City',         key: 'bill_to_city' },
  { label: 'Bill Postal',       key: 'bill_to_postal_code' },
  { label: 'Ship To Address',   key: 'ship_to_address' },
  { label: 'Ship Country',      key: 'ship_to_country' },
  { label: 'Ship State',        key: 'ship_to_state' },
  { label: 'Ship City',         key: 'ship_to_city' },
  { label: 'Ship Postal',       key: 'ship_to_postal_code' },
  { label: 'Website',           key: 'website' },
  { label: 'Valid Date',        key: 'valid_date',        format: 'date' },
  { label: 'License No.',       key: 'license_number' },
  { label: 'License Validity',  key: 'license_validity',  format: 'date' },
  { label: 'Approved',          key: 'is_approved' },
  { label: 'Approved Date',  key: 'approved_date',  format: 'date' },
  { label: 'Bank Name',      key: 'bank_name' },
  { label: 'Account No.',    key: 'bank_account_number' },
  { label: 'SWIFT',          key: 'bank_swift' },
  { label: 'IBAN',           key: 'bank_iban' },
  { label: 'Contact 1',      key: 'contact1_name' },
  { label: 'Email 1',        key: 'contact1_email' },
  { label: 'Phone 1',        key: 'contact1_phone' },
  { label: 'Remarks',        key: 'remarks' },
]

// ── Attachments Modal ─────────────────────────────────────────────────────────
function AttachmentsModal({ entityId, entityType, entityName, company, currentUser, onClose }) {
  const [files, setFiles]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef            = useRef(null)

  useEffect(() => {
    fetchFiles()
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  async function fetchFiles() {
    setLoading(true)
    const { data } = await supabase.from('attachments')
      .select('*').eq('entity_id', entityId).order('created_at', { ascending: false })
    setFiles(data || [])
    setLoading(false)
  }

  async function uploadFiles(fileList) {
    if (!fileList?.length) return
    setUploading(true)
    for (const file of Array.from(fileList)) {
      const path = `${entityType}/${entityId}/${Date.now()}_${file.name}`
      const { error: storageErr } = await supabase.storage.from('master-attachments').upload(path, file)
      if (storageErr) { alert(`Upload failed: ${storageErr.message}`); continue }
      await supabase.from('attachments').insert({
        entity_type: entityType, entity_id: entityId,
        file_name: file.name, file_path: path,
        file_size: file.size, mime_type: file.type,
        uploaded_by: currentUser?.name || '', company,
      })
    }
    setUploading(false)
    fetchFiles()
  }

  async function handleDelete(file) {
    if (!confirm(`Delete "${file.file_name}"?`)) return
    await supabase.storage.from('master-attachments').remove([file.file_path])
    await supabase.from('attachments').delete().eq('id', file.id)
    setFiles(prev => prev.filter(f => f.id !== file.id))
  }

  async function handleDownload(file) {
    const { data } = await supabase.storage.from('master-attachments').createSignedUrl(file.file_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function formatSize(bytes) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function fileIcon(mime) {
    if (!mime) return '📄'
    if (mime.includes('pdf')) return '📕'
    if (mime.includes('word') || mime.includes('document')) return '📘'
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📗'
    if (mime.includes('image')) return '🖼️'
    if (mime.includes('zip') || mime.includes('rar')) return '🗜️'
    return '📄'
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Attachments</h2>
            <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[360px]">{entityName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Upload zone */}
        <div className="px-6 pt-4 shrink-0">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
          >
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => uploadFiles(e.target.files)} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-blue-600 font-medium">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <p className="text-sm text-gray-500">Drop files here or <span className="text-blue-600 font-medium">click to browse</span></p>
                <p className="text-xs text-gray-400">PDF, Word, Excel, images — any file type</p>
              </div>
            )}
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No attachments yet</div>
          ) : files.map(file => (
            <div key={file.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition group">
              <span className="text-xl shrink-0">{fileIcon(file.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{file.file_name}</p>
                <p className="text-xs text-gray-400">{formatSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString()} · {file.uploaded_by || '—'}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => handleDownload(file)}
                  className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </button>
                <button onClick={() => handleDelete(file)}
                  className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Code Format Section ───────────────────────────────────────────────────────
const CODE_FORMAT_TABLE_CFG = {
  customer: { table: 'customers_master', codeField: 'customer_code', countryField: 'country' },
  supplier: { table: 'vendors_master',   codeField: 'supplier_code', countryField: 'bill_to_country' },
  product:  { table: 'products_master',  codeField: 'product_code',  countryField: 'country_of_origin' },
}

function CodeFormatSection({ type, company, showToast, onAfterSave }) {
  const defaults = type === 'customer' ? CUSTOMER_PREFIX
    : type === 'supplier' ? SUPPLIER_PREFIX
    : COUNTRY_ISO2

  const [customFormats, setCustomFormats] = useState([])
  const [open, setOpen]       = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newCountry, setNewCountry] = useState('')
  const [newPrefix, setNewPrefix]   = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    supabase.from('code_formats').select('*').eq('type', type).eq('company', company)
      .then(({ data }) => setCustomFormats(data || []))
  }, [type, company])

  const customCountries  = new Set(customFormats.map(f => f.country))
  const builtInCountries = new Set(Object.keys(defaults))
  const availableCountries = COUNTRIES.filter(c => !builtInCountries.has(c) && !customCountries.has(c))

  async function addFormat() {
    if (!newCountry.trim() || !newPrefix.trim()) return
    setSaving(true)
    const prefix  = newPrefix.trim().toUpperCase()
    const country = newCountry.trim()

    const { data, error } = await supabase.from('code_formats')
      .insert([{ type, country, prefix, company }])
      .select().single()

    if (error) { setSaving(false); showToast?.(error.message, 'error'); return }

    // Auto-assign codes to existing entries from this country that have no code yet
    const cfg = CODE_FORMAT_TABLE_CFG[type]
    const fallbackPrefix = type === 'customer' ? 'CXX' : type === 'supplier' ? 'SXX' : 'XX'
    const { data: countryEntries } = await supabase.from(cfg.table)
      .select('id' + (type === 'product' ? ', material_type' : '') + `, ${cfg.codeField}`)
      .eq(cfg.countryField, country).eq('company', company)
    const needsCodes = (countryEntries || []).filter(e => {
      const code = e[cfg.codeField]
      return !code || code === '' || code.startsWith(fallbackPrefix)
    })

    let updated = 0
    if (needsCodes?.length > 0) {
      const { data: existingCodes } = await supabase.from(cfg.table)
        .select(cfg.codeField).eq('company', company)
      const pool = [...(existingCodes || [])]

      for (const entry of needsCodes) {
        const fullPrefix = type === 'product'
          ? `${prefix}${MATERIAL_TYPES.find(m => m.label === entry.material_type)?.code || 'PR'}`
          : prefix
        const re  = new RegExp(`^${fullPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\d+)$`)
        const nums = pool.map(r => r[cfg.codeField]).filter(Boolean)
          .map(c => { const m = c.match(re); return m ? parseInt(m[1], 10) : null }).filter(n => n !== null)
        const seq     = nums.length > 0 ? Math.max(...nums) + 1 : 10001
        const newCode = `${fullPrefix} ${seq}`
        await supabase.from(cfg.table).update({ [cfg.codeField]: newCode }).eq('id', entry.id)
        pool.push({ [cfg.codeField]: newCode })
        updated++
      }
    }

    setSaving(false)
    setCustomFormats(f => [...f, data])
    setNewCountry(''); setNewPrefix(''); setShowAdd(false)
    showToast?.(updated > 0
      ? `Code format saved. ${updated} existing entr${updated !== 1 ? 'ies' : 'y'} updated.`
      : 'Code format saved.', 'success')
    if (updated > 0) onAfterSave?.()
  }

  async function deleteFormat(id) {
    await supabase.from('code_formats').delete().eq('id', id)
    setCustomFormats(f => f.filter(x => x.id !== id))
  }

  const title = type === 'customer' ? 'Customer Code Master'
    : type === 'supplier' ? 'Supplier Code Master' : 'Product Code Master'
  const prefixLabel = type === 'product' ? 'ISO2 Code' : 'Prefix'
  const prefixHint  = type === 'product' ? '2-letter ISO (e.g. TR)' : '3-letter prefix (e.g. CTR)'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {Object.keys(defaults).length + customFormats.length} formats
          </span>
        </div>
        <svg style={{ width: 14, height: 14, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" className="text-gray-400 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="flex justify-end pt-4 mb-4">
            <button onClick={() => setShowAdd(v => !v)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Format
            </button>
          </div>

          {showAdd && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Country</label>
                <select value={newCountry} onChange={e => setNewCountry(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Select country…</option>
                  {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="w-44">
                <label className="text-xs font-medium text-gray-600 mb-1 block">{prefixLabel}</label>
                <input value={newPrefix} onChange={e => setNewPrefix(e.target.value)}
                  placeholder={prefixHint}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => e.key === 'Enter' && addFormat()} />
              </div>
              <button onClick={addFormat} disabled={saving || !newCountry || !newPrefix}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setShowAdd(false); setNewCountry(''); setNewPrefix('') }}
                className="border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm transition">
                Cancel
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Country</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{prefixLabel}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customFormats.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{f.country}</td>
                    <td className="px-4 py-2.5 font-mono text-blue-600 font-medium">{f.prefix}</td>
                    <td className="px-4 py-2.5"><span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Custom</span></td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => deleteFormat(f.id)} className="text-red-400 hover:text-red-600 text-xs transition">Remove</button>
                    </td>
                  </tr>
                ))}
                {Object.entries(defaults).map(([country, prefix]) => (
                  <tr key={country} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{country}</td>
                    <td className="px-4 py-2.5 font-mono text-blue-600 font-medium">{prefix}</td>
                    <td className="px-4 py-2.5"><span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Built-in</span></td>
                    <td className="px-4 py-2.5" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomerSection({ company, showToast, isAdmin, currentUser, onAddInquiry }) {
  const [entries, setEntries]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [showReport, setShowReport]   = useState(false)
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(EMPTY_CUSTOMER)
  const [freeTextBillState, setFreeTextBillState] = useState(false)
  const [freeTextShipState, setFreeTextShipState] = useState(false)
  const [manualBillAddress, setManualBillAddress] = useState(false)
  const [manualShipAddress, setManualShipAddress] = useState(false)
  const [errors, setErrors]           = useState({})
  const [saving, setSaving]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch]           = useState('')
  const [approvalFilter, setApprovalFilter] = useState('all')
  const [sortField, setSortField]     = useState('created_at')
  const [sortDir, setSortDir]         = useState('desc')
  const [importFile, setImportFile]   = useState(null)
  const [visibleContacts, setVisibleContacts] = useState(1)
  const [attachmentEntry, setAttachmentEntry] = useState(null)
  const [confirmRecode, setConfirmRecode] = useState(false)
  const [recoding, setRecoding]       = useState(false)
  const firstInputRef                 = useRef(null)
  const importFileRef                 = useRef(null)

  const OLD_CODE_RE = /^[A-Z]{3}-\d+$/
  const legacyEntries = entries.filter(e => e.customer_code && OLD_CODE_RE.test(e.customer_code))

  async function fixOldCodes() {
    setConfirmRecode(false)
    setRecoding(true)
    let updated = 0
    for (const entry of legacyEntries) {
      const newCode = await generateCustomerCode(entry.bill_to_country || '', company)
      const { error } = await supabase.from('customers_master').update({ customer_code: newCode }).eq('id', entry.id)
      if (!error) updated++
    }
    await fetchEntries()
    setRecoding(false)
    showToast(`${updated} customer code${updated !== 1 ? 's' : ''} updated to new format`)
  }

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

  useEffect(() => { fetchEntries() }, [company])

  useEffect(() => {
    if (showForm) setTimeout(() => firstInputRef.current?.focus(), 50)
  }, [showForm])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && showForm) closeForm() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [showForm])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('customers_master').select('*').eq('company', company).order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY_CUSTOMER); setErrors({}); setFreeTextBillState(false); setFreeTextShipState(false); setManualBillAddress(false); setManualShipAddress(false); setVisibleContacts(1) }

  function openAdd() { setEditing(null); setForm(EMPTY_CUSTOMER); setErrors({}); setFreeTextBillState(false); setFreeTextShipState(false); setManualBillAddress(false); setManualShipAddress(false); setVisibleContacts(1); setShowForm(true) }

  function openEdit(entry) {
    setEditing(entry)
    const billPresets = STATES_BY_COUNTRY[entry.bill_to_country] || []
    const shipPresets = STATES_BY_COUNTRY[entry.ship_to_country] || []
    setFreeTextBillState(!!(entry.bill_to_state && !billPresets.includes(entry.bill_to_state)))
    setFreeTextShipState(!!(entry.ship_to_state && !shipPresets.includes(entry.ship_to_state)))
    setManualBillAddress(!entry.bill_to_country && !!entry.bill_to_address)
    setManualShipAddress(!entry.ship_to_country && !!entry.ship_to_address)
    const f = Object.fromEntries(Object.keys(EMPTY_CUSTOMER).map(k => [k, entry[k] ?? '']))
    f.is_approved = !!entry.is_approved
    setForm(f)
    setErrors({})
    const contactCount = entry.contact3_name ? 3 : entry.contact2_name ? 2 : 1
    setVisibleContacts(contactCount)
    setShowForm(true)
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: '' }))
  }

  function handleBillCountryChange(val) {
    setForm(prev => ({ ...prev, bill_to_country: val, bill_to_state: '' }))
    setFreeTextBillState(false)
  }

  function handleShipCountryChange(val) {
    setForm(prev => ({ ...prev, ship_to_country: val, ship_to_state: '' }))
    setFreeTextShipState(false)
  }

  function validate() {
    const e = {}
    if (!form.name?.trim()) e.name = 'Customer name is required'
    if (form.is_approved && !form.approved_date) e.approved_date = 'Approved date is required'
    return e
  }

  async function save(sendForApproval = false) {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const DATE_FIELDS = ['valid_date', 'approved_date']
    const payload = { ...form, company }
    DATE_FIELDS.forEach(f => { if (payload[f] === '') payload[f] = null })
    if (editing) {
      if (isAdmin) payload.pending_approval = false
      const { error } = await supabase.from('customers_master').update(payload).eq('id', editing.id)
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      logActivity({ actor: currentUser, company, module: 'Customer Master', action: 'edited', recordId: editing.id, recordLabel: form.name })
      showToast('Customer updated')
    } else {
      if (!payload.customer_code) payload.customer_code = await generateCustomerCode(form.country, company)
      if (sendForApproval) {
        payload.pending_approval = true
        payload.submitted_by = currentUser?.name || ''
        payload.is_approved = false
      } else {
        payload.pending_approval = false
      }
      const { error } = await supabase.from('customers_master').insert([payload])
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      if (sendForApproval) {
        await supabase.from('notifications').insert(
          ADMIN_USERS.map(name => ({
            recipient_name: name,
            message: `Customer "${form.name}" was submitted for approval by ${currentUser?.name || 'a user'}`,
            company,
          }))
        )
        logActivity({ actor: currentUser, company, module: 'Customer Master', action: 'submitted_for_approval', recordLabel: form.name })
      } else {
        logActivity({ actor: currentUser, company, module: 'Customer Master', action: 'created', recordLabel: form.name })
      }
      showToast(sendForApproval ? 'Sent for approval' : 'Customer added')
    }
    setSaving(false); closeForm(); fetchEntries()
  }

  async function handleDelete() {
    const deleted = confirmDelete
    await supabase.from('customers_master').delete().eq('id', deleted.id)
    logActivity({ actor: currentUser, company, module: 'Customer Master', action: 'deleted', recordId: deleted.id, recordLabel: deleted.name })
    setConfirmDelete(null); showToast('Entry deleted'); fetchEntries()
  }

  const filtered = applySortRows(
    entries.filter(e => {
      if (approvalFilter === 'approved' && !e.is_approved) return false
      if (approvalFilter === 'unapproved' && e.is_approved) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        e.name?.toLowerCase().includes(q) ||
        e.customer_code?.toLowerCase().includes(q) ||
        e.bill_to_country?.toLowerCase().includes(q) ||
        e.bill_to_city?.toLowerCase().includes(q) ||
        e.ship_to_country?.toLowerCase().includes(q) ||
        e.ship_to_city?.toLowerCase().includes(q) ||
        e.contact1_name?.toLowerCase().includes(q) ||
        e.contact1_email?.toLowerCase().includes(q)
      )
    }),
    sortField, sortDir
  )

  const hasBillPresetStates = !!(STATES_BY_COUNTRY[form.bill_to_country]?.length)
  const hasShipPresetStates = !!(STATES_BY_COUNTRY[form.ship_to_country]?.length)

  return (
    <div className="space-y-4">
      {importFile && (
        <MasterImportModal file={importFile} tableKey="customers_master" company={company}
          onClose={() => setImportFile(null)}
          onImported={count => { setImportFile(null); showToast(`${count} customer${count !== 1 ? 's' : ''} imported`); logActivity({ actor: currentUser, company, module: 'Customer Master', action: 'imported', details: { count } }); fetchEntries() }} />
      )}
      {confirmDelete && (
        <DeleteModal
          displayName={confirmDelete.name}
          masterLabel="Customer Master"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-blue-600 bg-blue-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Customer Master</h2>
            <p className="text-gray-400 text-xs">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} for {company}</p>
          </div>
        </div>
        <div className="flex items-center gap-2" style={{ paddingRight: 52 }}>
          <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { if (e.target.files[0]) { setImportFile(e.target.files[0]); e.target.value = '' } }} />
          <button onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import
          </button>
          {isAdmin && legacyEntries.length > 0 && (
            <button onClick={() => setConfirmRecode(true)} disabled={recoding}
              className="flex items-center gap-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50">
              {recoding
                ? <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              }
              {recoding ? 'Updating…' : `Fix Codes (${legacyEntries.length})`}
            </button>
          )}
          {isAdmin && (
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Report
          </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Entry
          </button>
        </div>
      </div>

      {confirmRecode && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Update {legacyEntries.length} customer code{legacyEntries.length !== 1 ? 's' : ''}?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  The following customers have old-format codes and will be assigned new country-based codes:
                </p>
                <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {legacyEntries.map(e => (
                    <li key={e.id} className="text-xs text-gray-600 flex items-center gap-2">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{e.customer_code}</span>
                      <span className="text-gray-400">→</span>
                      <span className="truncate">{e.name}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 mt-2">New codes will be based on each customer's billing country.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmRecode(false)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={fixOldCodes} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-medium transition">Update All</button>
            </div>
          </div>
        </div>
      )}

      {showReport && <MasterReportModal title="Customer Master" rows={filtered} columns={CUSTOMER_REPORT_COLS} company={company} onClose={() => setShowReport(false)} />}

      {/* Approval filter + search */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shrink-0">
          {[['all','All'],['approved','Approved'],['unapproved','Unapproved']].map(([v,l]) => (
            <button key={v} onClick={() => setApprovalFilter(v)}
              className={`px-3.5 py-2 text-xs font-medium transition ${approvalFilter === v ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-blue-600 bg-blue-50">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <p className="text-gray-800 font-medium">{entries.length === 0 ? 'No customers yet' : 'No results found'}</p>
          <p className="text-gray-400 text-sm mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started.' : 'Try adjusting your search.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-medium">{filtered.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
            <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '1200px', width: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50 cursor-pointer select-none hover:text-gray-700"
                      style={{ position: 'sticky', top: 0, left: 0, zIndex: 30, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}
                      onClick={() => toggleSort('name')}>
                    Customer Name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </th>
                  {[
                    { label: 'Code',              field: 'customer_code' },
                    { label: 'Bill To Address',   field: null },
                    { label: 'Ship To Address',   field: null },
                    { label: 'Website',           field: null },
                    { label: 'Contact 1 Name', field: null },
                    { label: 'Contact 1 Email',   field: null },
                    { label: 'Contact 1 Phone',   field: null },
                    { label: 'License No.',       field: null },
                    { label: 'License Validity',  field: 'license_validity' },
                    { label: 'Approved Date',     field: 'approved_date' },
                    { label: 'Added',             field: 'created_at' },
                    { label: 'Remarks',           field: null },
                  ].map(({ label, field }) => (
                    <th key={label}
                      className={`text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50 ${field ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
                      style={{ position: 'sticky', top: 0, zIndex: 10 }}
                      onClick={field ? () => toggleSort(field) : undefined}>
                      {label}{field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
                    </th>
                  ))}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      style={{ position: 'sticky', top: 0, right: 140, zIndex: 30, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.04)' }}>
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      style={{ position: 'sticky', top: 0, right: 0, zIndex: 30, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-blue-50/30 transition group">
                    <td className="px-5 py-3.5"
                        style={{ position: 'sticky', left: 0, zIndex: 20, background: 'white', boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {entry.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="font-semibold text-gray-900 whitespace-nowrap">{entry.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {entry.customer_code || <span className="text-gray-300 font-sans font-normal">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[180px]"><RemarksCell text={entry.bill_to_address} /></td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[180px]"><RemarksCell text={entry.ship_to_address} /></td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {entry.website
                        ? <a href={entry.website.startsWith('http') ? entry.website : `https://${entry.website}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs max-w-[140px] block truncate">
                            {entry.website}
                          </a>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact1_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact1_email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact1_phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.license_number || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.license_validity)}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.approved_date)}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[160px]">
                      <RemarksCell text={entry.remarks} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap"
                        style={{ position: 'sticky', right: 140, zIndex: 20, background: 'white', boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.04)' }}>
                      {entry.pending_approval ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border text-orange-700 bg-orange-50 border-orange-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          Pending Approval
                        </span>
                      ) : (
                        isAdmin ? (
                          <ApprovalBadge entry={entry} onToggle={async (id, val) => {
                            await supabase.from('customers_master').update({ is_approved: val, pending_approval: false }).eq('id', id)
                            if (val && entry.submitted_by) {
                              await supabase.from('notifications').insert({
                                recipient_name: entry.submitted_by,
                                message: `Customer "${entry.name}" has been approved`,
                                company,
                              })
                            }
                            fetchEntries()
                          }} />
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${entry.is_approved ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${entry.is_approved ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {entry.is_approved ? 'Approved' : 'Unapproved'}
                          </span>
                        )
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap"
                        style={{ position: 'sticky', right: 0, zIndex: 20, background: 'white', boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-1">
                        {onAddInquiry && (
                          <button onClick={() => onAddInquiry(entry.name)}
                            className="flex items-center gap-1 text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg text-xs font-medium transition">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                            Inquiry
                          </button>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => setAttachmentEntry(entry)}
                            className="flex items-center gap-1 text-gray-500 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            Files
                          </button>
                          <button onClick={() => openEdit(entry)}
                            className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Edit
                          </button>
                          <button onClick={() => setConfirmDelete(entry)}
                            className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {attachmentEntry && (
        <AttachmentsModal
          entityId={attachmentEntry.id}
          entityType="customer"
          entityName={attachmentEntry.name}
          company={company}
          currentUser={currentUser}
          onClose={() => setAttachmentEntry(null)}
        />
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Customer' : 'New Customer'}</h2>
                <p className="text-gray-400 text-xs mt-0.5">Customer Master</p>
              </div>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Customer Name + Code */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Field label="Customer Name *" error={errors.name}>
                    <input
                      ref={firstInputRef}
                      className={inputCls(!!errors.name)}
                      value={form.name}
                      placeholder="e.g. Pharma Corp Ltd"
                      onChange={e => setField('name', e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Customer Code">
                  <input className={`${inputCls(false)} bg-gray-50 text-gray-500 font-mono`}
                    value={editing ? (form.customer_code || '—') : 'Auto-generated'}
                    readOnly disabled />
                </Field>
              </div>

              {/* Approval status — admins only */}
              {isAdmin && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Approval Status</p>
                      <p className="text-xs text-gray-400 mt-0.5">Mark customer as approved for order processing</p>
                    </div>
                    <button type="button"
                      onClick={() => {
                        const next = !form.is_approved
                        setField('is_approved', next)
                        if (next && !form.approved_date) setField('approved_date', new Date().toISOString().split('T')[0])
                        if (!next) setField('approved_date', '')
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_approved ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_approved ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {form.is_approved && (
                    <Field label="Approved Date *" error={errors.approved_date}>
                      <input type="date" className={inputCls(!!errors.approved_date)} value={form.approved_date}
                        onChange={e => setField('approved_date', e.target.value)} />
                    </Field>
                  )}
                </div>
              )}

              {/* Addresses */}
              <div className="grid grid-cols-2 gap-4">
                {/* Bill To */}
                <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bill To</p>
                    <button type="button"
                      onClick={() => { setManualBillAddress(p => !p); setField('bill_to_country', ''); setField('bill_to_state', ''); setField('bill_to_city', ''); setField('bill_to_postal_code', ''); setFreeTextBillState(false) }}
                      className="text-xs text-blue-600 hover:underline">
                      {manualBillAddress ? 'Use structured fields' : 'Type manually'}
                    </button>
                  </div>
                  {manualBillAddress ? (
                    <Field label="Full Address">
                      <textarea className={`${inputCls(false)} resize-none`} rows={5} value={form.bill_to_address}
                        placeholder="Type full billing address…"
                        onChange={e => setField('bill_to_address', e.target.value)} />
                    </Field>
                  ) : (
                    <>
                      <Field label="Street / Building">
                        <textarea className={`${inputCls(false)} resize-none`} rows={2} value={form.bill_to_address}
                          placeholder="Street / building…"
                          onChange={e => setField('bill_to_address', e.target.value)} />
                      </Field>
                      <Field label="Country">
                        <select className={selectCls(false)} value={form.bill_to_country} onChange={e => handleBillCountryChange(e.target.value)}>
                          <option value="">Select country…</option>
                          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label="State / Province">
                        <div className="flex gap-2">
                          {hasBillPresetStates && !freeTextBillState ? (
                            <select className={`${selectCls(false)} flex-1`} value={form.bill_to_state} onChange={e => setField('bill_to_state', e.target.value)}>
                              <option value="">Select state…</option>
                              {STATES_BY_COUNTRY[form.bill_to_country].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <input className={`${inputCls(false)} flex-1`} value={form.bill_to_state} placeholder="Enter state…"
                              onChange={e => setField('bill_to_state', e.target.value)} />
                          )}
                          {hasBillPresetStates && (
                            <button type="button" title={freeTextBillState ? 'Switch to dropdown' : 'Switch to free text'}
                              onClick={() => { setFreeTextBillState(p => !p); setField('bill_to_state', '') }}
                              className="px-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition text-sm">✎</button>
                          )}
                        </div>
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="City">
                          <input className={inputCls(false)} value={form.bill_to_city} placeholder="e.g. New York"
                            onChange={e => setField('bill_to_city', e.target.value)} />
                        </Field>
                        <Field label="Postal Code">
                          <input className={inputCls(false)} value={form.bill_to_postal_code} placeholder="e.g. 10001"
                            onChange={e => setField('bill_to_postal_code', e.target.value)} />
                        </Field>
                      </div>
                    </>
                  )}
                </div>

                {/* Ship To */}
                <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ship To</p>
                    <button type="button"
                      onClick={() => { setManualShipAddress(p => !p); setField('ship_to_country', ''); setField('ship_to_state', ''); setField('ship_to_city', ''); setField('ship_to_postal_code', ''); setFreeTextShipState(false) }}
                      className="text-xs text-blue-600 hover:underline">
                      {manualShipAddress ? 'Use structured fields' : 'Type manually'}
                    </button>
                  </div>
                  {manualShipAddress ? (
                    <Field label="Full Address">
                      <textarea className={`${inputCls(false)} resize-none`} rows={5} value={form.ship_to_address}
                        placeholder="Type full shipping address…"
                        onChange={e => setField('ship_to_address', e.target.value)} />
                    </Field>
                  ) : (
                    <>
                      <Field label="Street / Building">
                        <textarea className={`${inputCls(false)} resize-none`} rows={2} value={form.ship_to_address}
                          placeholder="Street / building…"
                          onChange={e => setField('ship_to_address', e.target.value)} />
                      </Field>
                      <Field label="Country">
                        <select className={selectCls(false)} value={form.ship_to_country} onChange={e => handleShipCountryChange(e.target.value)}>
                          <option value="">Select country…</option>
                          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label="State / Province">
                        <div className="flex gap-2">
                          {hasShipPresetStates && !freeTextShipState ? (
                            <select className={`${selectCls(false)} flex-1`} value={form.ship_to_state} onChange={e => setField('ship_to_state', e.target.value)}>
                              <option value="">Select state…</option>
                              {STATES_BY_COUNTRY[form.ship_to_country].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <input className={`${inputCls(false)} flex-1`} value={form.ship_to_state} placeholder="Enter state…"
                              onChange={e => setField('ship_to_state', e.target.value)} />
                          )}
                          {hasShipPresetStates && (
                            <button type="button" title={freeTextShipState ? 'Switch to dropdown' : 'Switch to free text'}
                              onClick={() => { setFreeTextShipState(p => !p); setField('ship_to_state', '') }}
                              className="px-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition text-sm">✎</button>
                          )}
                        </div>
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="City">
                          <input className={inputCls(false)} value={form.ship_to_city} placeholder="e.g. Amsterdam"
                            onChange={e => setField('ship_to_city', e.target.value)} />
                        </Field>
                        <Field label="Postal Code">
                          <input className={inputCls(false)} value={form.ship_to_postal_code} placeholder="e.g. 1011 AB"
                            onChange={e => setField('ship_to_postal_code', e.target.value)} />
                        </Field>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Website + Valid Date */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Website">
                  <input className={inputCls(false)} value={form.website} placeholder="e.g. www.example.com"
                    onChange={e => setField('website', e.target.value)} />
                </Field>
                <Field label="Valid Date">
                  <input type="date" className={inputCls(false)} value={form.valid_date}
                    onChange={e => setField('valid_date', e.target.value)} />
                </Field>
              </div>

              {/* Contact blocks */}
              {Array.from({ length: visibleContacts }, (_, i) => i + 1).map(n => (
                <div key={n} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact {n}</p>
                    {n > 1 && (
                      <button type="button" onClick={() => { setField(`contact${n}_name`, ''); setField(`contact${n}_email`, ''); setField(`contact${n}_phone`, ''); setVisibleContacts(n - 1) }}
                        className="text-xs text-red-400 hover:text-red-600 transition">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Name">
                      <input className={inputCls(false)} value={form[`contact${n}_name`]} placeholder="Full name"
                        onChange={e => setField(`contact${n}_name`, e.target.value)} />
                    </Field>
                    <Field label="Email">
                      <input type="email" className={inputCls(false)} value={form[`contact${n}_email`]} placeholder="email@example.com"
                        onChange={e => setField(`contact${n}_email`, e.target.value)} />
                    </Field>
                    <Field label="Phone">
                      <input type="tel" className={inputCls(false)} value={form[`contact${n}_phone`]} placeholder="+1 555 000 0000"
                        onChange={e => setField(`contact${n}_phone`, e.target.value)} />
                    </Field>
                  </div>
                </div>
              ))}
              {visibleContacts < 3 && (
                <button type="button" onClick={() => setVisibleContacts(v => v + 1)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Contact
                </button>
              )}

              {/* License */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="License Number">
                  <input className={inputCls(false)} value={form.license_number} placeholder="e.g. LIC-2024-00123"
                    onChange={e => setField('license_number', e.target.value)} />
                </Field>
                <Field label="License Validity">
                  <input type="date" className={inputCls(false)} value={form.license_validity}
                    onChange={e => setField('license_validity', e.target.value)} />
                </Field>
              </div>

              {/* Bank Details */}
              <div className="border border-gray-100 rounded-xl p-4 space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bank Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Bank Name"><input className={inputCls(false)} value={form.bank_name} placeholder="e.g. HSBC" onChange={e => setField('bank_name', e.target.value)} /></Field>
                  <Field label="Bank Address"><input className={inputCls(false)} value={form.bank_address} placeholder="Bank branch address" onChange={e => setField('bank_address', e.target.value)} /></Field>
                  <Field label="Account Name"><input className={inputCls(false)} value={form.bank_account_name} placeholder="Account holder name" onChange={e => setField('bank_account_name', e.target.value)} /></Field>
                  <Field label="Account Number"><input className={inputCls(false)} value={form.bank_account_number} placeholder="Account number" onChange={e => setField('bank_account_number', e.target.value)} /></Field>
                  <Field label="Routing / Sort Code"><input className={inputCls(false)} value={form.bank_routing_number} placeholder="e.g. 021000021" onChange={e => setField('bank_routing_number', e.target.value)} /></Field>
                  <Field label="SWIFT / BIC"><input className={inputCls(false)} value={form.bank_swift} placeholder="e.g. CHASUS33" onChange={e => setField('bank_swift', e.target.value)} /></Field>
                  <Field label="IBAN"><input className={inputCls(false)} value={form.bank_iban} placeholder="e.g. NL02ABNA0123456789" onChange={e => setField('bank_iban', e.target.value)} /></Field>
                  <Field label="Currency"><input className={inputCls(false)} value={form.bank_currency} placeholder="e.g. USD, EUR" onChange={e => setField('bank_currency', e.target.value)} /></Field>
                </div>
              </div>

              {/* Remarks */}
              <Field label="Remarks">
                <textarea className={`${inputCls(false)} resize-none`} rows={3} value={form.remarks}
                  placeholder="Any additional notes…"
                  onChange={e => setField('remarks', e.target.value)} />
              </Field>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 pb-5 pt-4 border-t border-gray-100 shrink-0">
              <button onClick={closeForm} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              {!isAdmin && !editing ? (
                <button onClick={() => save(true)} disabled={saving}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? 'Sending…' : 'Send for Approval'}
                </button>
              ) : (
                <button onClick={() => save(false)} disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <CodeFormatSection type="customer" company={company} showToast={showToast} onAfterSave={fetchEntries} />
    </div>
  )
}

// ── Supplier Section ──────────────────────────────────────────────────────────
const EMPTY_SUPPLIER = {
  name: '',
  supplier_code: '',
  vat_number: '',
  bill_to_address: '',
  bill_to_country: '', bill_to_state: '', bill_to_city: '', bill_to_postal_code: '',
  website: '',
  contact1_name: '', contact1_email: '', contact1_phone: '',
  contact2_name: '', contact2_email: '', contact2_phone: '',
  contact3_name: '', contact3_email: '', contact3_phone: '',
  approved_date: '', valid_through: '',
  license_number: '',
  license_validity: '',
  bank_name: '', bank_address: '', bank_account_name: '',
  bank_account_number: '', bank_routing_number: '',
  bank_swift: '', bank_iban: '', bank_currency: '',
  remarks: '',
}

const SUPPLIER_REPORT_COLS = [
  { label: 'Code',             key: 'supplier_code' },
  { label: 'Name',             key: 'name' },
  { label: 'VAT Number',       key: 'vat_number' },
  { label: 'Address',          key: 'bill_to_address' },
  { label: 'Country',          key: 'bill_to_country' },
  { label: 'State',            key: 'bill_to_state' },
  { label: 'City',             key: 'bill_to_city' },
  { label: 'Postal Code',      key: 'bill_to_postal_code' },
  { label: 'Website',          key: 'website' },
  { label: 'License No.',      key: 'license_number' },
  { label: 'License Validity', key: 'license_validity', format: 'date' },
  { label: 'Approved Date',    key: 'approved_date',    format: 'date' },
  { label: 'Valid Through',    key: 'valid_through',    format: 'date' },
  { label: 'Contact 1',        key: 'contact1_name' },
  { label: 'Email 1',          key: 'contact1_email' },
  { label: 'Phone 1',          key: 'contact1_phone' },
  { label: 'Bank Name',        key: 'bank_name' },
  { label: 'Account Name',     key: 'bank_account_name' },
  { label: 'Account No.',      key: 'bank_account_number' },
  { label: 'SWIFT',            key: 'bank_swift' },
  { label: 'IBAN',             key: 'bank_iban' },
  { label: 'Remarks',          key: 'remarks' },
]

function SupplierSection({ company, showToast, currentUser, isAdmin }) {
  const [entries, setEntries]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)
  const [showReport, setShowReport]       = useState(false)
  const [editing, setEditing]             = useState(null)
  const [form, setForm]                   = useState(EMPTY_SUPPLIER)
  const [freeTextState, setFreeTextState] = useState(false)
  const [errors, setErrors]               = useState({})
  const [saving, setSaving]               = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch]               = useState('')
  const [sortField, setSortField]         = useState('created_at')
  const [sortDir, setSortDir]             = useState('desc')
  const [visibleContacts, setVisibleContacts] = useState(1)
  const [attachmentEntry, setAttachmentEntry] = useState(null)
  const [importFile, setImportFile]        = useState(null)
  const firstInputRef                     = useRef(null)
  const importFileRef                     = useRef(null)

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

  useEffect(() => { fetchEntries() }, [company])

  useEffect(() => {
    if (showForm) setTimeout(() => firstInputRef.current?.focus(), 50)
  }, [showForm])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && showForm) closeForm() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [showForm])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('vendors_master').select('*').eq('company', company).order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY_SUPPLIER); setErrors({}); setFreeTextState(false); setVisibleContacts(1) }
  function openAdd()   { setEditing(null); setForm(EMPTY_SUPPLIER); setErrors({}); setFreeTextState(false); setVisibleContacts(1); setShowForm(true) }

  function openEdit(entry) {
    setEditing(entry)
    const presets = STATES_BY_COUNTRY[entry.bill_to_country] || []
    setFreeTextState(!!(entry.bill_to_state && !presets.includes(entry.bill_to_state)))
    setForm(Object.fromEntries(Object.keys(EMPTY_SUPPLIER).map(k => [k, entry[k] || ''])))
    setErrors({})
    setVisibleContacts(entry.contact3_name ? 3 : entry.contact2_name ? 2 : 1)
    setShowForm(true)
  }

  function handleCountryChange(val) {
    setForm(prev => ({ ...prev, bill_to_country: val, bill_to_state: '' }))
    setFreeTextState(false)
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.name?.trim()) e.name = 'Supplier name is required'
    return e
  }

  async function save() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const payload = { ...form, company }
    if (editing) {
      const { error } = await supabase.from('vendors_master').update(payload).eq('id', editing.id)
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      logActivity({ actor: currentUser, company, module: 'Vendors Master', action: 'edited', recordId: editing.id, recordLabel: form.name })
      showToast('Supplier updated')
    } else {
      if (!payload.supplier_code) payload.supplier_code = await generateSupplierCode(form.bill_to_country, company)
      const { error } = await supabase.from('vendors_master').insert([payload])
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      logActivity({ actor: currentUser, company, module: 'Vendors Master', action: 'created', recordLabel: form.name })
      showToast('Supplier added')
    }
    setSaving(false); closeForm(); fetchEntries()
  }

  async function handleDelete() {
    const deleted = confirmDelete
    await supabase.from('vendors_master').delete().eq('id', deleted.id)
    logActivity({ actor: currentUser, company, module: 'Vendors Master', action: 'deleted', recordId: deleted.id, recordLabel: deleted.name })
    setConfirmDelete(null); showToast('Entry deleted'); fetchEntries()
  }

  const filtered = applySortRows(
    entries.filter(e => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        e.name?.toLowerCase().includes(q) ||
        e.bill_to_address?.toLowerCase().includes(q) ||
        e.bill_to_country?.toLowerCase().includes(q) ||
        e.bill_to_city?.toLowerCase().includes(q) ||
        e.contact1_name?.toLowerCase().includes(q) ||
        e.contact1_email?.toLowerCase().includes(q) ||
        e.license_number?.toLowerCase().includes(q)
      )
    }),
    sortField, sortDir
  )

  const hasPresetStates = !!(STATES_BY_COUNTRY[form.bill_to_country]?.length)

  return (
    <div className="space-y-4">
      {importFile && (
        <MasterImportModal file={importFile} tableKey="vendors_master" company={company}
          onClose={() => setImportFile(null)}
          onImported={count => { setImportFile(null); showToast(`${count} supplier${count !== 1 ? 's' : ''} imported`); logActivity({ actor: currentUser, company, module: 'Supplier Master', action: 'imported', details: { count } }); fetchEntries() }} />
      )}
      {confirmDelete && (
        <DeleteModal
          displayName={confirmDelete.name}
          masterLabel="Supplier Master"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-purple-600 bg-purple-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Supplier Master</h2>
            <p className="text-gray-400 text-xs">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} for {company}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { if (e.target.files[0]) { setImportFile(e.target.files[0]); e.target.value = '' } }} />
          <button onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import
          </button>
          {isAdmin && (
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Report
          </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Entry
          </button>
        </div>
      </div>

      {showReport && <MasterReportModal title="Supplier Master" rows={filtered} columns={SUPPLIER_REPORT_COLS} company={company} onClose={() => setShowReport(false)} />}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search suppliers…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-purple-600 bg-purple-50">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <p className="text-gray-800 font-medium">{entries.length === 0 ? 'No suppliers yet' : 'No results found'}</p>
          <p className="text-gray-400 text-sm mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started.' : 'Try adjusting your search.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-medium">{filtered.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
            <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '1200px', width: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50 cursor-pointer select-none"
                      style={{ position: 'sticky', top: 0, left: 0, zIndex: 30, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}
                      onClick={() => toggleSort('name')}>
                    Supplier Name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </th>
                  {[
                    { label: 'Code',             field: 'supplier_code' },
                    { label: 'VAT Number',       field: null },
                    { label: 'Address',          field: null },
                    { label: 'Country',          field: 'bill_to_country' },
                    { label: 'City',             field: null },
                    { label: 'Website',          field: null },
                    { label: 'Contact 1 Name',   field: null },
                    { label: 'Contact 1 Email',  field: null },
                    { label: 'Contact 1 Phone',  field: null },
                    { label: 'Contact 2 Name',   field: null },
                    { label: 'Contact 2 Email',  field: null },
                    { label: 'Contact 2 Phone',  field: null },
                    { label: 'Contact 3 Name',   field: null },
                    { label: 'Contact 3 Email',  field: null },
                    { label: 'Contact 3 Phone',  field: null },
                    { label: 'Approved Date',    field: 'approved_date' },
                    { label: 'Valid Through',    field: 'valid_through' },
                    { label: 'License No.',      field: null },
                    { label: 'License Validity', field: 'license_validity' },
                    { label: 'Remarks',          field: null },
                    { label: 'Added',            field: 'created_at' },
                  ].map(({ label, field }) => (
                    <th key={label}
                        className={`text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50${field ? ' cursor-pointer select-none' : ''}`}
                        style={{ position: 'sticky', top: 0, zIndex: 10 }}
                        onClick={field ? () => toggleSort(field) : undefined}>
                      {label}{field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
                    </th>
                  ))}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      style={{ position: 'sticky', top: 0, right: 0, zIndex: 30, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-purple-50/30 transition group">
                    <td className="px-5 py-3.5"
                        style={{ position: 'sticky', left: 0, zIndex: 20, background: 'white', boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {entry.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="font-semibold text-gray-900 whitespace-nowrap">{entry.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-mono font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {entry.supplier_code || <span className="text-gray-300 font-sans font-normal">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.vat_number || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[180px]">
                      <RemarksCell text={entry.bill_to_address} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.bill_to_country || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.bill_to_city || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {entry.website
                        ? <a href={entry.website.startsWith('http') ? entry.website : `https://${entry.website}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs max-w-[140px] block truncate">
                            {entry.website}
                          </a>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact1_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact1_email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact1_phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact2_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact2_email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact2_phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact3_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact3_email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact3_phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.approved_date)}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.valid_through)}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.license_number || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.license_validity)}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[160px]">
                      <RemarksCell text={entry.remarks} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap"
                        style={{ position: 'sticky', right: 0, zIndex: 20, background: 'white', boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setAttachmentEntry(entry)}
                          className="flex items-center gap-1 text-gray-500 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          Files
                        </button>
                        <button onClick={() => openEdit(entry)}
                          className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit
                        </button>
                        <button onClick={() => setConfirmDelete(entry)}
                          className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {attachmentEntry && (
        <AttachmentsModal
          entityId={attachmentEntry.id}
          entityType="supplier"
          entityName={attachmentEntry.name}
          company={company}
          currentUser={currentUser}
          onClose={() => setAttachmentEntry(null)}
        />
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
                <p className="text-gray-400 text-xs mt-0.5">Supplier Master</p>
              </div>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Supplier Name + Code */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Field label="Supplier Name *" error={errors.name}>
                    <input ref={firstInputRef} className={inputCls(!!errors.name)} value={form.name}
                      placeholder="e.g. Global Supplies Inc" onChange={e => setField('name', e.target.value)} />
                  </Field>
                </div>
                <Field label="Supplier Code">
                  <input className={`${inputCls(false)} bg-gray-50 text-gray-500 font-mono`}
                    value={editing ? (form.supplier_code || '—') : 'Auto-generated'} readOnly disabled />
                </Field>
              </div>

              {/* VAT Number */}
              <Field label="VAT Number">
                <input className={inputCls(false)} value={form.vat_number} placeholder="e.g. NL123456789B01"
                  onChange={e => setField('vat_number', e.target.value)} />
              </Field>

              {/* Address */}
              <div className="space-y-3">
                <Field label="Street / Building">
                  <textarea className={`${inputCls(false)} resize-none`} rows={2} value={form.bill_to_address}
                    placeholder="Street / building…"
                    onChange={e => setField('bill_to_address', e.target.value)} />
                </Field>
                <Field label="Country">
                  <select className={selectCls(false)} value={form.bill_to_country} onChange={e => handleCountryChange(e.target.value)}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="State / Province">
                  <div className="flex gap-2">
                    {hasPresetStates && !freeTextState ? (
                      <select className={`${selectCls(false)} flex-1`} value={form.bill_to_state} onChange={e => setField('bill_to_state', e.target.value)}>
                        <option value="">Select state…</option>
                        {STATES_BY_COUNTRY[form.bill_to_country].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input className={`${inputCls(false)} flex-1`} value={form.bill_to_state} placeholder="Enter state…"
                        onChange={e => setField('bill_to_state', e.target.value)} />
                    )}
                    {hasPresetStates && (
                      <button type="button" title={freeTextState ? 'Switch to dropdown' : 'Switch to free text'}
                        onClick={() => { setFreeTextState(p => !p); setField('bill_to_state', '') }}
                        className="px-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition text-sm">✎</button>
                    )}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <input className={inputCls(false)} value={form.bill_to_city} placeholder="e.g. New York"
                      onChange={e => setField('bill_to_city', e.target.value)} />
                  </Field>
                  <Field label="Postal Code">
                    <input className={inputCls(false)} value={form.bill_to_postal_code} placeholder="e.g. 10001"
                      onChange={e => setField('bill_to_postal_code', e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* Website */}
              <Field label="Website">
                <input className={inputCls(false)} value={form.website} placeholder="e.g. www.example.com"
                  onChange={e => setField('website', e.target.value)} />
              </Field>

              {/* Contact blocks */}
              {Array.from({ length: visibleContacts }, (_, i) => i + 1).map(n => (
                <div key={n} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact {n}</p>
                    {n > 1 && (
                      <button type="button" onClick={() => { setField(`contact${n}_name`, ''); setField(`contact${n}_email`, ''); setField(`contact${n}_phone`, ''); setVisibleContacts(n - 1) }}
                        className="text-xs text-red-400 hover:text-red-600 transition">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Name">
                      <input className={inputCls(false)} value={form[`contact${n}_name`]} placeholder="Full name"
                        onChange={e => setField(`contact${n}_name`, e.target.value)} />
                    </Field>
                    <Field label="Email">
                      <input type="email" className={inputCls(false)} value={form[`contact${n}_email`]} placeholder="email@example.com"
                        onChange={e => setField(`contact${n}_email`, e.target.value)} />
                    </Field>
                    <Field label="Phone">
                      <input type="tel" className={inputCls(false)} value={form[`contact${n}_phone`]} placeholder="+1 555 000 0000"
                        onChange={e => setField(`contact${n}_phone`, e.target.value)} />
                    </Field>
                  </div>
                </div>
              ))}
              {visibleContacts < 3 && (
                <button type="button" onClick={() => setVisibleContacts(v => v + 1)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Contact
                </button>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Approved Date">
                  <input type="date" className={inputCls(false)} value={form.approved_date}
                    onChange={e => setField('approved_date', e.target.value)} />
                </Field>
                <Field label="Valid Through">
                  <input type="date" className={inputCls(false)} value={form.valid_through}
                    onChange={e => setField('valid_through', e.target.value)} />
                </Field>
              </div>

              {/* License */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="License Number">
                  <input className={inputCls(false)} value={form.license_number} placeholder="e.g. LIC-2024-00123"
                    onChange={e => setField('license_number', e.target.value)} />
                </Field>
                <Field label="License Validity">
                  <input type="date" className={inputCls(false)} value={form.license_validity}
                    onChange={e => setField('license_validity', e.target.value)} />
                </Field>
              </div>

              {/* Bank Details */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Bank Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bank Name"><input className={inputCls(false)} value={form.bank_name} placeholder="e.g. JPMorgan Chase" onChange={e => setField('bank_name', e.target.value)} /></Field>
                  <Field label="Bank Address"><input className={inputCls(false)} value={form.bank_address} placeholder="Bank branch address" onChange={e => setField('bank_address', e.target.value)} /></Field>
                  <Field label="Account Name"><input className={inputCls(false)} value={form.bank_account_name} placeholder="Account holder name" onChange={e => setField('bank_account_name', e.target.value)} /></Field>
                  <Field label="Account Number"><input className={inputCls(false)} value={form.bank_account_number} placeholder="Account number" onChange={e => setField('bank_account_number', e.target.value)} /></Field>
                  <Field label="Routing / Sort Code"><input className={inputCls(false)} value={form.bank_routing_number} placeholder="e.g. 021000021" onChange={e => setField('bank_routing_number', e.target.value)} /></Field>
                  <Field label="SWIFT / BIC"><input className={inputCls(false)} value={form.bank_swift} placeholder="e.g. CHASUS33" onChange={e => setField('bank_swift', e.target.value)} /></Field>
                  <Field label="IBAN"><input className={inputCls(false)} value={form.bank_iban} placeholder="e.g. NL02ABNA0123456789" onChange={e => setField('bank_iban', e.target.value)} /></Field>
                  <Field label="Currency"><input className={inputCls(false)} value={form.bank_currency} placeholder="e.g. USD, EUR" onChange={e => setField('bank_currency', e.target.value)} /></Field>
                </div>
              </div>

              {/* Remarks */}
              <Field label="Remarks">
                <textarea className={`${inputCls(false)} resize-none`} rows={3} value={form.remarks}
                  placeholder="Any additional notes…"
                  onChange={e => setField('remarks', e.target.value)} />
              </Field>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 pb-5 pt-4 border-t border-gray-100 shrink-0">
              <button onClick={closeForm} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      <CodeFormatSection type="supplier" company={company} showToast={showToast} onAfterSave={fetchEntries} />
    </div>
  )
}

// ── Product Section ───────────────────────────────────────────────────────────
const EMPTY_PRODUCT = {
  name: '',
  product_code: '',
  manufacturer: '',
  material_type: '',
  country_of_origin: '',
  ndc_ma_code: '',
  hsn_code: '',
  pack_size: '',
  pack_dimension: '',
  pack_weight: '',
  unit_of_measurement: '',
  remarks: '',
}

const PRODUCT_REPORT_COLS = [
  { label: 'Code',          key: 'product_code' },
  { label: 'Name',          key: 'name' },
  { label: 'Manufacturer',  key: 'manufacturer' },
  { label: 'Material Type', key: 'material_type' },
  { label: 'Country',       key: 'country_of_origin' },
  { label: 'NDC / MA Code', key: 'ndc_ma_code' },
  { label: 'HSN Code',      key: 'hsn_code' },
  { label: 'Pack Size',     key: 'pack_size' },
  { label: 'Pack Dimension',key: 'pack_dimension' },
  { label: 'Pack Weight',   key: 'pack_weight' },
  { label: 'UOM',           key: 'unit_of_measurement' },
  { label: 'Remarks',       key: 'remarks' },
]

function ProductSection({ company, showToast, currentUser, isAdmin }) {
  const [entries, setEntries]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [showReport, setShowReport]   = useState(false)
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(EMPTY_PRODUCT)
  const [errors, setErrors]           = useState({})
  const [saving, setSaving]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch]           = useState('')
  const [sortField, setSortField]     = useState('created_at')
  const [sortDir, setSortDir]         = useState('desc')
  const [importFile, setImportFile]   = useState(null)
  const firstInputRef                 = useRef(null)
  const importFileRef                 = useRef(null)

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

  useEffect(() => { fetchEntries() }, [company])

  useEffect(() => {
    if (showForm) setTimeout(() => firstInputRef.current?.focus(), 50)
  }, [showForm])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && showForm) closeForm() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [showForm])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('products_master').select('*').eq('company', company).order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY_PRODUCT); setErrors({}) }
  function openAdd()   { setEditing(null); setForm(EMPTY_PRODUCT); setErrors({}); setShowForm(true) }

  function openEdit(entry) {
    setEditing(entry)
    setForm(Object.fromEntries(Object.keys(EMPTY_PRODUCT).map(k => [k, entry[k] || ''])))
    setErrors({})
    setShowForm(true)
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.name?.trim()) e.name = 'Product name is required'
    return e
  }

  async function save() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const payload = { ...form, company }
    if (editing) {
      const { error } = await supabase.from('products_master').update(payload).eq('id', editing.id)
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      logActivity({ actor: currentUser, company, module: 'Products Master', action: 'edited', recordId: editing.id, recordLabel: form.name })
      showToast('Product updated')
    } else {
      if (!payload.product_code) payload.product_code = await generateProductCode(form.country_of_origin, form.material_type, company)
      const { error } = await supabase.from('products_master').insert([payload])
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      logActivity({ actor: currentUser, company, module: 'Products Master', action: 'created', recordLabel: form.name })
      showToast('Product added')
    }
    setSaving(false); closeForm(); fetchEntries()
  }

  async function handleDelete() {
    const deleted = confirmDelete
    await supabase.from('products_master').delete().eq('id', deleted.id)
    logActivity({ actor: currentUser, company, module: 'Products Master', action: 'deleted', recordId: deleted.id, recordLabel: deleted.name })
    setConfirmDelete(null); showToast('Entry deleted'); fetchEntries()
  }

  const filtered = applySortRows(
    entries.filter(e => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        e.name?.toLowerCase().includes(q) ||
        e.pack_size?.toLowerCase().includes(q) ||
        e.ndc_ma_code?.toLowerCase().includes(q) ||
        e.country_of_origin?.toLowerCase().includes(q)
      )
    }),
    sortField, sortDir
  )

  return (
    <div className="space-y-4">
      {importFile && (
        <MasterImportModal file={importFile} tableKey="products_master" company={company}
          onClose={() => setImportFile(null)}
          onImported={count => { setImportFile(null); showToast(`${count} product${count !== 1 ? 's' : ''} imported`); logActivity({ actor: currentUser, company, module: 'Product Master', action: 'imported', details: { count } }); fetchEntries() }} />
      )}
      {confirmDelete && (
        <DeleteModal
          displayName={confirmDelete.name}
          masterLabel="Product Master"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-emerald-600 bg-emerald-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Product Master</h2>
            <p className="text-gray-400 text-xs">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} for {company}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { if (e.target.files[0]) { setImportFile(e.target.files[0]); e.target.value = '' } }} />
          <button onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import
          </button>
          {isAdmin && (
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Report
          </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Entry
          </button>
        </div>
      </div>

      {showReport && <MasterReportModal title="Product Master" rows={filtered} columns={PRODUCT_REPORT_COLS} company={company} onClose={() => setShowReport(false)} />}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-600 bg-emerald-50">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          </div>
          <p className="text-gray-800 font-medium">{entries.length === 0 ? 'No products yet' : 'No results found'}</p>
          <p className="text-gray-400 text-sm mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started.' : 'Try adjusting your search.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-medium">{filtered.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
            <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '900px', width: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50 cursor-pointer select-none"
                      style={{ position: 'sticky', top: 0, left: 0, zIndex: 30, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}
                      onClick={() => toggleSort('name')}>
                    Product Name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </th>
                  {[
                    { label: 'Code',             field: 'product_code' },
                    { label: 'Manufacturer',     field: 'manufacturer' },
                    { label: 'Material Type',    field: 'material_type' },
                    { label: 'Country',          field: 'country_of_origin' },
                    { label: 'NDC / MA Code',    field: null },
                    { label: 'HSN Code',         field: null },
                    { label: 'Pack Size',        field: null },
                    { label: 'UOM',              field: null },
                    { label: 'Added',            field: 'created_at' },
                  ].map(({ label, field }) => (
                    <th key={label}
                        className={`text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50${field ? ' cursor-pointer select-none' : ''}`}
                        style={{ position: 'sticky', top: 0, zIndex: 10 }}
                        onClick={field ? () => toggleSort(field) : undefined}>
                      {label}{field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
                    </th>
                  ))}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      style={{ position: 'sticky', top: 0, right: 0, zIndex: 30, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-emerald-50/30 transition group">
                    <td className="px-5 py-3.5"
                        style={{ position: 'sticky', left: 0, zIndex: 20, background: 'white', boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {entry.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="font-semibold text-gray-900 whitespace-nowrap">{entry.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {entry.product_code || <span className="text-gray-300 font-sans font-normal">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.manufacturer || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.material_type || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.country_of_origin || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.ndc_ma_code || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.hsn_code || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.pack_size || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.unit_of_measurement || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap"
                        style={{ position: 'sticky', right: 0, zIndex: 20, background: 'white', boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openEdit(entry)}
                          className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit
                        </button>
                        <button onClick={() => setConfirmDelete(entry)}
                          className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Product' : 'New Product'}</h2>
                <p className="text-gray-400 text-xs mt-0.5">Product Master</p>
              </div>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Name + Code */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Field label="Product Name *" error={errors.name}>
                    <input ref={firstInputRef} className={inputCls(!!errors.name)} value={form.name}
                      placeholder="e.g. Paracetamol 500mg" onChange={e => setField('name', e.target.value)} />
                  </Field>
                </div>
                <Field label="Product Code">
                  <input className={`${inputCls(false)} bg-gray-50 text-gray-500 font-mono`}
                    value={editing ? (form.product_code || '—') : 'Auto-generated'} readOnly disabled />
                </Field>
              </div>

              {/* Manufacturer + Material Type */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Manufacturer">
                  <input className={inputCls(false)} value={form.manufacturer} placeholder="e.g. Bayer AG"
                    onChange={e => setField('manufacturer', e.target.value)} />
                </Field>
                <Field label="Material Type">
                  <select className={selectCls(false)} value={form.material_type}
                    onChange={e => setField('material_type', e.target.value)}>
                    <option value="">Select type…</option>
                    {MATERIAL_TYPES.map(m => <option key={m.code} value={m.label}>{m.label} ({m.code})</option>)}
                  </select>
                </Field>
              </div>

              {/* Country + NDC */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Country of Origin">
                  <select className={selectCls(false)} value={form.country_of_origin}
                    onChange={e => setField('country_of_origin', e.target.value)}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="NDC / MA Product Code">
                  <input className={inputCls(false)} value={form.ndc_ma_code} placeholder="e.g. NDC 12345-678"
                    onChange={e => setField('ndc_ma_code', e.target.value)} />
                </Field>
              </div>

              {/* HSN Code + UOM */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="HSN Code">
                  <input className={inputCls(false)} value={form.hsn_code} placeholder="e.g. 30049099"
                    onChange={e => setField('hsn_code', e.target.value)} />
                </Field>
                <Field label="Unit of Measurement">
                  <select className={selectCls(false)} value={form.unit_of_measurement}
                    onChange={e => setField('unit_of_measurement', e.target.value)}>
                    <option value="">Select unit…</option>
                    {UNITS_OF_MEASUREMENT.map(u => <option key={u.code} value={u.code}>{u.label} ({u.code})</option>)}
                  </select>
                </Field>
              </div>

              {/* Pack Size + Pack Dimension + Pack Weight */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Pack Size">
                  <input className={inputCls(false)} value={form.pack_size} placeholder="e.g. 10×10 blister"
                    onChange={e => setField('pack_size', e.target.value)} />
                </Field>
                <Field label="Pack Dimension">
                  <input className={inputCls(false)} value={form.pack_dimension} placeholder="e.g. 100×50×30 mm"
                    onChange={e => setField('pack_dimension', e.target.value)} />
                </Field>
                <Field label="Pack Weight">
                  <input className={inputCls(false)} value={form.pack_weight} placeholder="e.g. 250g"
                    onChange={e => setField('pack_weight', e.target.value)} />
                </Field>
              </div>

              <Field label="Remarks">
                <textarea className={`${inputCls(false)} resize-none`} rows={3} value={form.remarks}
                  placeholder="Any additional notes…"
                  onChange={e => setField('remarks', e.target.value)} />
              </Field>
            </div>

            <div className="flex gap-3 px-6 pb-5 pt-4 border-t border-gray-100 shrink-0">
              <button onClick={closeForm} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      <CodeFormatSection type="product" company={company} showToast={showToast} onAfterSave={fetchEntries} />
    </div>
  )
}

// ── Generic Master Section (vendors / products / storage) ─────────────────────
function MasterSection({ masterKey, company, showToast, currentUser, isAdmin }) {
  const cfg = MASTERS[masterKey]
  const [entries, setEntries]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState({})
  const [errors, setErrors]       = useState({})
  const [saving, setSaving]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch]       = useState('')
  const [showReport, setShowReport] = useState(false)
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir]     = useState('desc')
  const [importFile, setImportFile] = useState(null)
  const firstInputRef             = useRef(null)
  const importFileRef             = useRef(null)

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

  useEffect(() => { fetchEntries() }, [company, masterKey])

  useEffect(() => {
    if (showForm) setTimeout(() => firstInputRef.current?.focus(), 50)
  }, [showForm])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && showForm) closeForm() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [showForm])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase.from(cfg.table).select('*').eq('company', company).order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  function emptyForm() { return cfg.fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {}) }
  function closeForm() { setShowForm(false); setEditing(null); setForm(emptyForm()); setErrors({}) }
  function openAdd()   { setEditing(null); setForm(emptyForm()); setErrors({}); setShowForm(true) }

  function openEdit(entry) {
    setEditing(entry)
    setForm(cfg.fields.reduce((acc, f) => ({ ...acc, [f.key]: entry[f.key] || '' }), {}))
    setErrors({}); setShowForm(true)
  }

  function validate() {
    const e = {}
    cfg.fields.filter(f => f.required).forEach(f => {
      if (!form[f.key]?.trim()) e[f.key] = `${f.label} is required`
    })
    return e
  }

  async function save() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const payload = { ...form, company }
    if (editing) {
      await supabase.from(cfg.table).update(payload).eq('id', editing.id)
      logActivity({ actor: currentUser, company, module: cfg.label, action: 'edited', recordId: editing.id, recordLabel: form.name })
      showToast(`${cfg.label.split(' ')[0]} updated`)
    } else {
      await supabase.from(cfg.table).insert([payload])
      logActivity({ actor: currentUser, company, module: cfg.label, action: 'created', recordLabel: form.name })
      showToast(`${cfg.label.split(' ')[0]} added`)
    }
    setSaving(false); closeForm(); fetchEntries()
  }

  async function handleDelete() {
    const deleted = confirmDelete
    await supabase.from(cfg.table).delete().eq('id', deleted.id)
    logActivity({ actor: currentUser, company, module: cfg.label, action: 'deleted', recordId: deleted.id, recordLabel: deleted.name })
    setConfirmDelete(null); showToast('Entry deleted'); fetchEntries()
  }

  const filtered = applySortRows(
    entries.filter(e => {
      const q = search.toLowerCase()
      return !q || cfg.fields.some(f => e[f.key]?.toLowerCase().includes(q))
    }),
    sortField, sortDir
  )

  return (
    <div className="space-y-4">
      {importFile && (
        <MasterImportModal file={importFile} tableKey={cfg.table} company={company}
          onClose={() => setImportFile(null)}
          onImported={count => { setImportFile(null); showToast(`${count} entr${count !== 1 ? 'ies' : 'y'} imported`); logActivity({ actor: currentUser, company, module: cfg.label, action: 'imported', details: { count } }); fetchEntries() }} />
      )}
      {confirmDelete && (
        <DeleteModal
          displayName={confirmDelete.name}
          masterLabel={cfg.label}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>{cfg.icon}</div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{cfg.label}</h2>
            <p className="text-gray-400 text-xs">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} for {company}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { if (e.target.files[0]) { setImportFile(e.target.files[0]); e.target.value = '' } }} />
          <button onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import
          </button>
          {isAdmin && (
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Report
          </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Entry
          </button>
        </div>
      </div>

      {showReport && <MasterReportModal title={cfg.label} rows={filtered} columns={cfg.columns.map(c => ({ label: c.label, key: c.key, format: c.format }))} company={company} onClose={() => setShowReport(false)} />}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${cfg.label.toLowerCase()}…`}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 [&_svg]:w-8 [&_svg]:h-8 ${cfg.color}`}>{cfg.icon}</div>
          <p className="text-gray-800 font-medium">{entries.length === 0 ? `No ${cfg.label.toLowerCase()} yet` : 'No results found'}</p>
          <p className="text-gray-400 text-sm mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started.' : 'Try adjusting your search.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-medium">{filtered.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {cfg.columns.map(col => (
                  <th key={col.key}
                      className={`text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide${col.sortable ? ' cursor-pointer select-none' : ''} bg-gray-50`}
                      style={{ position: 'sticky', top: 0, zIndex: 2 }}
                      onClick={col.sortable ? () => toggleSort(col.sortable) : undefined}>
                    {col.label}{col.sortable && <SortIcon field={col.sortable} sortField={sortField} sortDir={sortDir} />}
                  </th>
                ))}
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50"
                    style={{ position: 'sticky', top: 0, zIndex: 2 }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-blue-50/30 transition group">
                  {cfg.columns.map((col, i) => (
                    <td key={col.key} className="px-5 py-3.5">
                      {i === 0 ? (
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {entry.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900">{entry[col.key]}</span>
                        </div>
                      ) : col.format === 'date' ? (
                        <span className="text-gray-400 text-xs">{formatDate(entry[col.key])}</span>
                      ) : (
                        <span className="text-gray-600">{entry[col.key] || <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => openEdit(entry)}
                        className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit
                      </button>
                      <button onClick={() => setConfirmDelete(entry)}
                        className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Entry' : `New ${cfg.label.split(' ')[0]}`}</h2>
                <p className="text-gray-400 text-xs mt-0.5">{cfg.label}</p>
              </div>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {cfg.fields.map((f, i) => (
                <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`} error={errors[f.key]}>
                  <input
                    ref={i === 0 ? firstInputRef : null}
                    className={inputCls(!!errors[f.key])}
                    value={form[f.key] || ''}
                    placeholder={f.placeholder}
                    onChange={e => { setForm(prev => ({ ...prev, [f.key]: e.target.value })); setErrors(prev => ({ ...prev, [f.key]: '' })) }}
                    onKeyDown={e => e.key === 'Enter' && i === cfg.fields.length - 1 && save()}
                  />
                </Field>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={closeForm} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Company Master ────────────────────────────────────────────────────────────
const COMPANY_PROFILES = [
  { key: 'Jupiter Research Services Inc',   short: 'JRS Inc',   country: 'United States' },
  { key: 'Jupiter Research Services BV',    short: 'JRS BV',    country: 'Netherlands'   },
  { key: 'Jupiter Research Services India', short: 'JRS India', country: 'India'         },
]

const EMPTY_CO = {
  legal_name: '', address1: '', address2: '', city: '', state: '', country: '',
  postal_code: '', phone: '', fax: '', email: '', website: '',
  tax_id: '', vat_number: '',
  bank_name: '', bank_address: '', bank_account_name: '',
  bank_account_number: '', bank_routing_number: '', bank_routing_wire: '',
  bank_swift: '', bank_iban: '', bank_currency: '',
}

const COMPANY_REPORT_COLS = [
  { label: 'Company',        key: 'company' },
  { label: 'Legal Name',     key: 'legal_name' },
  { label: 'Tax ID',         key: 'tax_id' },
  { label: 'VAT Number',     key: 'vat_number' },
  { label: 'Address',        key: 'address1' },
  { label: 'City',           key: 'city' },
  { label: 'Country',        key: 'country' },
  { label: 'Phone',          key: 'phone' },
  { label: 'Email',          key: 'email' },
  { label: 'Website',        key: 'website' },
  { label: 'Bank Name',      key: 'bank_name' },
  { label: 'Account Name',   key: 'bank_account_name' },
  { label: 'Account No.',    key: 'bank_account_number' },
  { label: 'SWIFT',          key: 'bank_swift' },
  { label: 'IBAN',           key: 'bank_iban' },
]

function CompanyMaster({ showToast, isAdmin }) {
  const [activeKey, setActiveKey]   = useState(COMPANY_PROFILES[0].key)
  const [profiles, setProfiles]     = useState({})
  const [editing, setEditing]       = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [form, setForm]             = useState(EMPTY_CO)
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase.from('company_master').select('*')
    const map = {}
    ;(data || []).forEach(r => { map[r.company] = r })
    setProfiles(map)
    setLoading(false)
  }

  function startEdit() {
    const ex = profiles[activeKey] || {}
    setForm(Object.fromEntries(Object.keys(EMPTY_CO).map(k => [k, ex[k] ?? ''])))
    setEditing(true)
  }

  function cancelEdit() { setEditing(false); setForm(EMPTY_CO) }

  async function save() {
    setSaving(true)
    const payload = { ...form, company: activeKey, updated_at: new Date().toISOString() }
    const ex = profiles[activeKey]
    const { error } = ex?.id
      ? await supabase.from('company_master').update(payload).eq('id', ex.id)
      : await supabase.from('company_master').insert([payload])
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    showToast('Company profile saved')
    setSaving(false); setEditing(false); fetchAll()
  }

  function sf(k, v) { setForm(p => ({ ...p, [k]: v })) }

  const profile = profiles[activeKey] || {}
  const hasData = !!profile.legal_name || !!profile.address1

  function ViewRow({ label, value }) {
    return (
      <div className="flex gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-36 shrink-0 pt-0.5">{label}</span>
        <span className="text-sm text-gray-700">{value || <span className="text-gray-300 italic">—</span>}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Company sub-tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1">
        {COMPANY_PROFILES.map(cp => (
          <button key={cp.key} onClick={() => { setActiveKey(cp.key); setEditing(false) }}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition
              ${activeKey === cp.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            {cp.short}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-gray-400 text-sm">Loading…</div>
      ) : editing ? (
        /* ── Edit Form ── */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">{COMPANY_PROFILES.find(c => c.key === activeKey)?.short} — Edit Profile</h3>
            <div className="flex gap-2">
              <button onClick={cancelEdit} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={save} disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </div>

          {/* General */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">General Information</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Legal Name"><input className={inputCls(false)} value={form.legal_name} onChange={e => sf('legal_name', e.target.value)} placeholder="Full legal name" /></Field>
              <Field label="Tax ID / EIN"><input className={inputCls(false)} value={form.tax_id} onChange={e => sf('tax_id', e.target.value)} placeholder="e.g. 12-3456789" /></Field>
              <Field label="VAT Number"><input className={inputCls(false)} value={form.vat_number} onChange={e => sf('vat_number', e.target.value)} placeholder="e.g. NL123456789B01" /></Field>
              <Field label="Website"><input className={inputCls(false)} value={form.website} onChange={e => sf('website', e.target.value)} placeholder="e.g. www.jupiterrs.com" /></Field>
            </div>
          </div>

          {/* Address */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Address</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Address Line 1"><input className={inputCls(false)} value={form.address1} onChange={e => sf('address1', e.target.value)} placeholder="Street address" /></Field>
              <Field label="Address Line 2"><input className={inputCls(false)} value={form.address2} onChange={e => sf('address2', e.target.value)} placeholder="Suite, floor, etc." /></Field>
              <Field label="City"><input className={inputCls(false)} value={form.city} onChange={e => sf('city', e.target.value)} placeholder="City" /></Field>
              <Field label="State / Province"><input className={inputCls(false)} value={form.state} onChange={e => sf('state', e.target.value)} placeholder="State or province" /></Field>
              <Field label="Country">
                <select className={selectCls(false)} value={form.country} onChange={e => sf('country', e.target.value)}>
                  <option value="">Select country…</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Postal Code"><input className={inputCls(false)} value={form.postal_code} onChange={e => sf('postal_code', e.target.value)} placeholder="Postal / ZIP code" /></Field>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Phone"><input className={inputCls(false)} value={form.phone} onChange={e => sf('phone', e.target.value)} placeholder="+1 555 000 0000" /></Field>
              <Field label="Fax"><input className={inputCls(false)} value={form.fax} onChange={e => sf('fax', e.target.value)} placeholder="+1 555 000 0001" /></Field>
              <Field label="Email"><input className={inputCls(false)} value={form.email} onChange={e => sf('email', e.target.value)} placeholder="info@example.com" /></Field>
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Bank Details</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bank Name"><input className={inputCls(false)} value={form.bank_name} onChange={e => sf('bank_name', e.target.value)} placeholder="e.g. JPMorgan Chase" /></Field>
              <Field label="Bank Address"><input className={inputCls(false)} value={form.bank_address} onChange={e => sf('bank_address', e.target.value)} placeholder="Bank branch address" /></Field>
              <Field label="Account Name"><input className={inputCls(false)} value={form.bank_account_name} onChange={e => sf('bank_account_name', e.target.value)} placeholder="Account holder name" /></Field>
              <Field label="Account Number"><input className={inputCls(false)} value={form.bank_account_number} onChange={e => sf('bank_account_number', e.target.value)} placeholder="Account number" /></Field>
              <Field label="Routing ACH"><input className={inputCls(false)} value={form.bank_routing_number} onChange={e => sf('bank_routing_number', e.target.value)} placeholder="e.g. 021202337" /></Field>
              <Field label="Routing Wire"><input className={inputCls(false)} value={form.bank_routing_wire} onChange={e => sf('bank_routing_wire', e.target.value)} placeholder="e.g. 021000021" /></Field>
              <Field label="SWIFT / BIC"><input className={inputCls(false)} value={form.bank_swift} onChange={e => sf('bank_swift', e.target.value)} placeholder="e.g. CHASUS33" /></Field>
              <Field label="IBAN"><input className={inputCls(false)} value={form.bank_iban} onChange={e => sf('bank_iban', e.target.value)} placeholder="e.g. NL02ABNA0123456789" /></Field>
              <Field label="Currency"><input className={inputCls(false)} value={form.bank_currency} onChange={e => sf('bank_currency', e.target.value)} placeholder="e.g. USD, EUR, INR" /></Field>
            </div>
          </div>
        </div>
      ) : (
        /* ── View Mode ── */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{COMPANY_PROFILES.find(c => c.key === activeKey)?.short}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{activeKey}</p>
            </div>
            <div className="flex gap-2">
              {hasData && isAdmin && (
                <button onClick={() => setShowReport(true)}
                  className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Report
                </button>
              )}
              <button onClick={startEdit}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                {hasData ? 'Edit Profile' : 'Add Profile'}
              </button>
            </div>
            {showReport && <MasterReportModal title="Company Master" rows={Object.values(profiles)} columns={COMPANY_REPORT_COLS} company="All Companies" onClose={() => setShowReport(false)} />}
          </div>

          {!hasData ? (
            <div className="text-center py-10 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
              <p className="text-sm">No profile yet — click <span className="font-semibold text-blue-600">Add Profile</span> to get started.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">General Information</p>
                <div className="space-y-2">
                  <ViewRow label="Legal Name" value={profile.legal_name} />
                  <ViewRow label="Tax ID / EIN" value={profile.tax_id} />
                  <ViewRow label="VAT Number" value={profile.vat_number} />
                  <ViewRow label="Website" value={profile.website} />
                </div>
              </div>
              <div className="border-t border-gray-50 pt-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Address</p>
                <div className="space-y-2">
                  <ViewRow label="Address" value={[profile.address1, profile.address2].filter(Boolean).join(', ')} />
                  <ViewRow label="City" value={profile.city} />
                  <ViewRow label="State / Province" value={profile.state} />
                  <ViewRow label="Country" value={profile.country} />
                  <ViewRow label="Postal Code" value={profile.postal_code} />
                </div>
              </div>
              <div className="border-t border-gray-50 pt-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact</p>
                <div className="space-y-2">
                  <ViewRow label="Phone" value={profile.phone} />
                  <ViewRow label="Fax" value={profile.fax} />
                  <ViewRow label="Email" value={profile.email} />
                </div>
              </div>
              <div className="border-t border-gray-50 pt-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Bank Details</p>
                <div className="space-y-2">
                  <ViewRow label="Bank Name" value={profile.bank_name} />
                  <ViewRow label="Bank Address" value={profile.bank_address} />
                  <ViewRow label="Account Name" value={profile.bank_account_name} />
                  <ViewRow label="Account Number" value={profile.bank_account_number} />
                  <ViewRow label="Routing ACH" value={profile.bank_routing_number} />
                  <ViewRow label="Routing Wire" value={profile.bank_routing_wire} />
                  <ViewRow label="SWIFT / BIC" value={profile.bank_swift} />
                  <ViewRow label="IBAN" value={profile.bank_iban} />
                  <ViewRow label="Currency" value={profile.bank_currency} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Master Report Modal ───────────────────────────────────────────────────────
function MasterReportModal({ title, rows, columns, company, onClose }) {
  const [format, setFormat]       = useState('excel')
  const [generating, setGenerating] = useState(false)
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(() => new Set(rows.map(r => r.id)))

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const filtered = rows.filter(r =>
    !search.trim() || (r.name || '').toLowerCase().includes(search.trim().toLowerCase())
  )
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach(r => next.delete(r.id))
      else filtered.forEach(r => next.add(r.id))
      return next
    })
  }

  async function generate() {
    setGenerating(true)
    const exportRows = rows.filter(r => selected.has(r.id))
    const headers = columns.map(c => c.label)
    const body    = exportRows.map(r => columns.map(c => {
      const v = r[c.key]
      if (v == null || v === '') return '—'
      if (typeof v === 'boolean') return v ? 'Yes' : 'No'
      if (c.format === 'date') return formatDate(v)
      return String(v)
    }))
    const safeCompany = company.replace(/[^a-zA-Z0-9]/g, '-')
    const safeTitle   = title.replace(/\s+/g, '-')
    const dateTag     = new Date().toISOString().split('T')[0]

    if (format === 'excel') {
      const wsData = [headers, ...body]
      const ws     = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols']  = headers.map((h, i) => ({
        wch: Math.max(h.length, ...body.map(row => (row[i] || '').length)) + 2
      }))
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })]
        if (cell) cell.s = { font: { bold: true } }
      }
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, title)
      XLSX.writeFile(wb, `JRS-${safeCompany}-${safeTitle}-${dateTag}.xlsx`)
    } else {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text(company, 40, 36)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120)
      doc.text(`${title} Report`, 40, 50)
      doc.text(`Generated: ${new Date().toLocaleString()}  ·  ${exportRows.length} records`, 40, 62)
      doc.setTextColor(0)
      autoTable(doc, {
        head: [headers], body,
        startY: 76,
        styles: { fontSize: 7, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 40, right: 40 },
      })
      doc.save(`JRS-${safeCompany}-${safeTitle}-${dateTag}.pdf`)
    }
    setGenerating(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Export {title}</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {selected.size} of {rows.length} selected · {company}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Format picker */}
        <div className="px-6 pt-4 pb-3 shrink-0">
          <div className="flex gap-3">
            {[{ id: 'excel', label: 'Excel (.xlsx)' }, { id: 'pdf', label: 'PDF (.pdf)' }].map(f => (
              <button key={f.id} onClick={() => setFormat(f.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${format === f.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + select-all */}
        <div className="px-6 pb-2 shrink-0 space-y-2">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered}
                className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-xs font-medium text-gray-600">
                {allFilteredSelected ? 'Deselect all' : 'Select all'}{search.trim() ? ' matching' : ''}
              </span>
            </label>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="text-xs text-red-500 hover:text-red-700 transition">
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Scrollable record list */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 min-h-0">
          {filtered.length === 0
            ? <p className="text-center text-gray-400 text-sm py-6">No records match</p>
            : filtered.map(r => (
              <label key={r.id} className="flex items-center gap-3 py-2 cursor-pointer group">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)}
                  className="w-4 h-4 rounded accent-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate group-hover:text-blue-600 transition">{r.name || '—'}</p>
                  {(r.customer_code || r.supplier_code || r.product_code) && (
                    <p className="text-xs text-gray-400">{r.customer_code || r.supplier_code || r.product_code}</p>
                  )}
                </div>
              </label>
            ))
          }
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={generate} disabled={generating || selected.size === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
            {generating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {generating ? 'Exporting…' : `Export ${selected.size > 0 ? `(${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Masters Component ────────────────────────────────────────────────────
export default function Masters({ company, currentUser, isAdmin, onAddInquiry, initialTab = 'customers' }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [toast, setToast]         = useState(null)

  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  function showToast(msg, type) { setToast({ message: msg, type: type || 'success' }) }

  return (
    <div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="p-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Masters</h1>
          <p className="text-gray-400 text-sm mt-0.5">{company}</p>
        </div>

        {/* Active Section */}
        {activeTab === 'company'
          ? <CompanyMaster key="company" showToast={showToast} isAdmin={isAdmin} />
          : activeTab === 'customers'
            ? <CustomerSection key="customers" company={company} showToast={showToast} currentUser={currentUser} isAdmin={isAdmin} onAddInquiry={onAddInquiry} />
            : activeTab === 'vendors'
              ? <SupplierSection key="vendors" company={company} showToast={showToast} currentUser={currentUser} isAdmin={isAdmin} />
              : activeTab === 'products'
                ? <ProductSection key="products" company={company} showToast={showToast} currentUser={currentUser} isAdmin={isAdmin} />
                : <MasterSection key={activeTab} masterKey={activeTab} company={company} showToast={showToast} currentUser={currentUser} isAdmin={isAdmin} />
        }

      </div>
    </div>
  )
}
