import { useState, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import { supabase } from './supabase'
import { logActivity } from './auditLogger'

// Canonical config keyed by the short token ("Inc" | "BV" | "India").
// resolveCompany() maps whatever string App.jsx passes to the right token.
const COMPANY_CONFIG = {
  Inc: {
    name: 'JUPITER RESEARCH SERVICES INC',
    address: '3 KELLOGG CT, STE 10, EDISON, NJ 08817 USA',
    website: 'WWW.JRSLLC.COM | +1 848 248 1611',
    bank: {
      beneficiary: 'Jupiter Research Services Inc',
      bank: 'Chase Bank',
      address: '475 Main St Metuchen, NJ 08840 USA',
      account: '935205309',
      routingACH: '021202337',
      routingWire: '021000021',
      swift: 'CHASUS33XXX',
      iban: 'NA',
    },
  },
  BV: {
    name: 'JUPITER RESEARCH SERVICES BV',
    address: '',
    website: '',
    bank: { beneficiary: '', bank: '', address: '', account: '', routingACH: '', routingWire: '', swift: '', iban: '' },
  },
  India: {
    name: 'JUPITER RESEARCH SERVICES INDIA PVT LTD',
    address: '',
    website: '',
    bank: { beneficiary: '', bank: '', address: '', account: '', routingACH: '', routingWire: '', swift: '', iban: '' },
  },
}

// App.jsx stores full strings like "Jupiter Research Services BV".
// This function maps them to the short config keys used above.
function resolveCompany(company) {
  if (!company) return 'Inc'
  const c = String(company).toLowerCase()
  if (c.includes('india')) return 'India'
  if (c.includes('bv'))    return 'BV'
  return 'Inc'
}

const PAYMENT_TERMS_OPTIONS = ['Net 30', 'Net 60', 'Net 90', 'Prepayment', 'COD']
const INCOTERMS_OPTIONS = ['ExW', 'FOB', 'CIF', 'DDP', 'DAP', 'FCA']

const FOOTER_NOTES = [
  '1) Final sales will be subject to product availability and manufacturer\'s price increase at the time of actual order.',
  '2) For Clinical Trial / R&D purpose only. Not for resale / commercial or retail purpose.',
  '3) For any questions, reach out to projects@jrsllc.com',
  '4) Verify the banking details via phone call for security reasons.',
]

const TAGLINE =
  'Comparator Sourcing | Labeling & Packaging | Ancillary Supplies | Storage & Distribution | Controlled Ambient | Cold-Chain | Frozen | Delivering Solutions, Not Just Drugs'

function generateEstimateNumber() {
  const yr = String(new Date().getFullYear()).slice(2)
  return `${yr}${String(Date.now()).slice(-4)}`
}

function formatDateDisplay(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso + 'T00:00:00')
    const day = String(d.getDate()).padStart(2, '0')
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
    return `${day}/${mon}/${d.getFullYear()}`
  } catch {
    return iso
  }
}

async function loadLogoDataURL() {
  try {
    const res = await fetch('/logos/jupiter-logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ── Module-level named export — called by both this modal and the Estimates page ──
export async function generateEstimatePDF(data) {
  const {
    estNum, today, coName, coAddress, coWebsite, salesRepName,
    billToName, billToAddr1, billToAddr2, billToCountry,
    shipToName, shipToAddr1, shipToAddr2, shipToCountry,
    poNo, effectivePayTerms, validTill, effectiveIncoterms, note,
    lineItems, grandTotal, primaryCurrency,
    bankBeneficiary, bankName, bankAddr, bankAccount,
    bankRoutingACH, bankRoutingWire, bankSwift, bankIban,
  } = data

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297, lm = 14, rm = 14, uw = W - lm - rm

  const BLUE  = [30, 58, 138]
  const DARK  = [20, 20, 20]
  const GRAY  = [100, 100, 100]
  const LGRAY = [195, 200, 212]
  const WHITE = [255, 255, 255]
  const SLBL  = [228, 233, 248]
  const SVAL  = [246, 248, 254]

  doc.setFont('helvetica')

  // Top accent bar
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, W, 3, 'F')

  function sectionLabel(x, y, text) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...BLUE)
    doc.text(text, x, y)
    doc.setDrawColor(...BLUE)
    doc.setLineWidth(0.35)
    doc.line(x, y + 1.2, x + doc.getTextWidth(text), y + 1.2)
  }

  // ── TOP HEADER ──────────────────────────────────────────────────────
  const logoDataURL = await loadLogoDataURL()

  if (logoDataURL) {
    doc.addImage(logoDataURL, 'PNG', lm, 6, 95, 28)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BLUE)
    doc.text('JUPITER RESEARCH SERVICES', lm, 22)
  }

  // Company contact — right-aligned with consistent 3.8mm line spacing
  const rX = W - rm
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK)
  doc.text(coName, rX, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY)
  const addrWrapped = doc.splitTextToSize(coAddress || '', 90)
  let coY = 18
  addrWrapped.forEach(ln => { doc.text(ln, rX, coY, { align: 'right' }); coY += 3.8 })
  if (coWebsite) doc.text(coWebsite, rX, coY + 1, { align: 'right' })

  const banY = 39
  doc.setFillColor(...BLUE)
  doc.rect(lm, banY, uw, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...WHITE)
  doc.text('ESTIMATE', lm + 4, banY + 6.5)

  // ── 3-COLUMN LAYOUT: Bill To | Ship To | Estimate Details ────────
  const secY   = 53
  const COL_W  = 56
  const DET_W  = 60
  const COL2_X = lm + COL_W + 5
  const DET_X  = COL2_X + COL_W + 5
  const PX     = 4
  const PY     = 4

  function calcAddrBoxH(nameLine, lines, textW) {
    let count = 0
    if (nameLine) count += doc.splitTextToSize(nameLine, textW).length
    lines.filter(Boolean).forEach(ln => { count += doc.splitTextToSize(ln, textW).length })
    return PY + 7 + count * 4.8 + PY
  }

  function drawAddrBox(x, y, label, nameLine, lines, boxW, forceH) {
    const textW = boxW - PX * 2
    const h = forceH || calcAddrBoxH(nameLine, lines, textW)
    doc.setFillColor(247, 248, 252)
    doc.setDrawColor(210, 215, 228)
    doc.setLineWidth(0.1)
    doc.roundedRect(x, y, boxW, h, 2, 2, 'FD')
    sectionLabel(x + PX, y + PY + 3.5, label)
    let cy = y + PY + 11
    if (nameLine) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK)
      doc.splitTextToSize(nameLine, textW).forEach(wl => { doc.text(wl, x + PX, cy); cy += 4.8 })
    }
    lines.filter(Boolean).forEach(ln => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY)
      doc.splitTextToSize(ln, textW).forEach(wl => { doc.text(wl, x + PX, cy); cy += 4.8 })
    })
    return y + h
  }

  const quoteRows = [
    ['ESTIMATE #',   estNum],
    ['DATE',         formatDateDisplay(today)],
    ['SALES REP',    salesRepName],
    validTill          ? ['VALID TILL',   formatDateDisplay(validTill)] : null,
    effectiveIncoterms ? ['INCOTERMS',     effectiveIncoterms]          : null,
    effectivePayTerms  ? ['PAYMENT TERMS', effectivePayTerms]           : null,
    poNo               ? ['PO NO.',        poNo]                        : null,
    note               ? ['NOTE',          note]                        : null,
  ].filter(Boolean)

  const b1H = calcAddrBoxH(billToName, [billToAddr1, billToAddr2, billToCountry], COL_W - PX * 2)
  const b2H = calcAddrBoxH(shipToName, [shipToAddr1, shipToAddr2, shipToCountry], COL_W - PX * 2)
  const detailBoxH = PY + 7 + quoteRows.length * 6 + PY
  const tallestBoxH = Math.max(b1H, b2H, detailBoxH)

  drawAddrBox(lm,     secY, 'CUSTOMER ADDRESS', billToName, [billToAddr1, billToAddr2, billToCountry], COL_W, tallestBoxH)
  drawAddrBox(COL2_X, secY, 'SHIPPING ADDRESS', shipToName, [shipToAddr1, shipToAddr2, shipToCountry], COL_W, tallestBoxH)

  // Estimate details box (right column) — same height as address boxes
  doc.setFillColor(247, 248, 252)
  doc.setDrawColor(210, 215, 228)
  doc.setLineWidth(0.1)
  doc.roundedRect(DET_X, secY, DET_W, tallestBoxH, 2, 2, 'FD')
  sectionLabel(DET_X + PX, secY + PY + 3.5, 'ESTIMATE DETAILS')
  let rightY = secY + PY + 11
  quoteRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');   doc.setFontSize(6.5); doc.setTextColor(...GRAY)
    doc.text(label, DET_X + PX, rightY)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...DARK)
    doc.text(String(value), DET_X + PX + 24, rightY)
    rightY += 6
  })

  const leftBottom = secY + tallestBoxH

  // ── LINE ITEMS TABLE ─────────────────────────────────────────────
  const tY = leftBottom + 5

  const cw      = [12, 84, 15, 13, 29, 29]
  const cLabels = ['LINE', 'CODE & DESCRIPTION', 'QTY', 'U/M', 'UNIT PRICE', 'TOTAL']
  const thH     = 8

  function drawTableHeader(y) {
    doc.setFillColor(...BLUE)
    doc.rect(lm, y, uw, thH, 'F')
    let tx = lm
    cLabels.forEach((lbl, i) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...WHITE)
      doc.text(lbl, tx + cw[i] / 2, y + 5.5, { align: 'center' })
      tx += cw[i]
    })
  }

  drawTableHeader(tY)

  const SUB_H     = 4.5
  const SUB_LBL_W = 18
  const SUB_CPR   = 3
  const subPairW  = uw / SUB_CPR

  let ry = tY + thH

  lineItems.forEach((item, idx) => {
    const qty = parseFloat(item.qty) || 0
    const up  = parseFloat(item.unitPrice) || 0
    const tot = qty * up
    const isCharge = item.type === 'charge'

    const descLines = doc.splitTextToSize(item.description || '', cw[1] - 4)
    const mainH     = Math.max(10, descLines.length * 4.5 + 5)

    const subFields = isCharge ? [] : [
      item.ndcCode      && ['NDC/MA',       item.ndcCode],
      item.packSize     && ['Pack Size',    item.packSize],
      item.manufacturer && ['Manufacturer', item.manufacturer],
      item.batchNo      && ['Batch #',      item.batchNo],
      item.expiry       && ['Expiry',       item.expiry],
      item.htsCode      && ['HTS Code',     item.htsCode],
    ].filter(Boolean)

    const subRowCount = subFields.length > 0 ? Math.ceil(subFields.length / SUB_CPR) : 0
    const subTotalH   = subRowCount > 0 ? subRowCount * (SUB_H + 0.5) + 2 : 0
    const itemH       = mainH + subTotalH

    if (ry + itemH > H - 68) {
      doc.addPage(); ry = 16; drawTableHeader(ry); ry += thH
    }

    // Zebra striping — white / light steel grey; charge rows get a subtle cool tint
    if (isCharge) {
      doc.setFillColor(240, 244, 250)
    } else {
      doc.setFillColor(...(idx % 2 === 0 ? [255, 255, 255] : [243, 245, 249]))
    }
    doc.rect(lm, ry, uw, mainH, 'F')

    const midY = ry + mainH / 2 + 1.5
    const c2x  = lm + cw[0]
    const c3x  = c2x + cw[1]
    const c4x  = c3x + cw[2]
    const c5x  = c4x + cw[3]
    const c6x  = c5x + cw[4]

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BLUE)
    doc.text(String(idx + 1), lm + cw[0] / 2, midY, { align: 'center' })

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...DARK)
    let dy = ry + 4.5
    descLines.forEach(ln => { doc.text(ln, c2x + 2, dy); dy += 4.5 })

    if (!isCharge && item.item) {
      doc.setFontSize(6.5); doc.setTextColor(...GRAY)
      doc.text(item.item, c2x + 2, dy)
    }

    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
    if (isCharge) {
      doc.setTextColor(...GRAY)
      doc.text('—', c3x + cw[2] / 2, midY, { align: 'center' })
      doc.text('—', c4x + cw[3] / 2, midY, { align: 'center' })
      doc.setTextColor(...DARK)
    } else {
      doc.text(String(item.qty || ''), c3x + cw[2] / 2, midY, { align: 'center' })
      doc.text(item.um || '',          c4x + cw[3] / 2, midY, { align: 'center' })
    }

    const upStr  = up  > 0 ? `${item.currency} ${up.toFixed(2)}`  : '—'
    doc.text(upStr,  c6x - 2,    midY, { align: 'right' })
    const totStr = tot > 0 ? `${item.currency} ${tot.toFixed(2)}` : '—'
    doc.text(totStr, W - rm - 2, midY, { align: 'right' })

    ry += mainH

    if (subFields.length > 0) {
      let sx = lm, sy = ry + 1
      subFields.forEach(([label, value], si) => {
        if (si > 0 && si % SUB_CPR === 0) { sy += SUB_H + 0.5; sx = lm }
        const valW = subPairW - SUB_LBL_W - 0.5
        doc.setFillColor(...SLBL)
        doc.rect(sx, sy, SUB_LBL_W, SUB_H, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(50, 70, 130)
        doc.text(label, sx + 1.5, sy + SUB_H * 0.73)
        doc.setFillColor(...SVAL)
        doc.rect(sx + SUB_LBL_W, sy, valW, SUB_H, 'F')
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...DARK)
        doc.text(String(value).substring(0, 24), sx + SUB_LBL_W + 1.5, sy + SUB_H * 0.73)
        sx += subPairW
      })
      ry += subTotalH
    }

    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2)
    doc.line(lm, ry, W - rm, ry)
  })

  // ── TOTAL ROW — highlighted ───────────────────────────────────────
  ry += 4
  const c5xTotal = lm + cw[0] + cw[1] + cw[2] + cw[3] + cw[4]
  doc.setFillColor(235, 241, 255)
  doc.rect(lm, ry, uw, 10, 'F')
  doc.setDrawColor(...BLUE); doc.setLineWidth(0.4)
  doc.line(lm, ry, lm + uw, ry)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BLUE)
  doc.text(`TOTAL (${primaryCurrency})`, c5xTotal - 2, ry + 6.5, { align: 'right' })
  doc.text(grandTotal.toFixed(2),        W - rm - 2,   ry + 6.5, { align: 'right' })
  ry += 14

  // ── FOOTER — pinned to bottom on sparse pages ────────────────────
  const ftY  = Math.max(ry, H - 78)
  const nW   = 100
  const divX = lm + nW + 3
  const bkX  = divX + 4
  const bkW  = W - rm - bkX

  // Notes
  sectionLabel(lm, ftY, 'NOTES')
  let ny = ftY + 7
  FOOTER_NOTES.forEach(n => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...DARK)
    doc.splitTextToSize(n, nW - 2).forEach(ln => { doc.text(ln, lm, ny); ny += 3.6 })
    ny += 1
  })

  // Bank details — light grey sidebar box
  const bkRows = [
    ['Beneficiary',  bankBeneficiary],
    ['Bank',         bankName],
    ['Address',      bankAddr],
    ['Account #',    bankAccount],
    ['Routing ACH',  bankRoutingACH],
    ['Routing Wire', bankRoutingWire],
    ['SWIFT',        bankSwift],
    ['IBAN',         bankIban],
  ].filter(([, v]) => v)

  const bkBoxH = 9 + bkRows.length * 4.4 + 4
  doc.setFillColor(245, 246, 250)
  doc.setDrawColor(210, 215, 228)
  doc.setLineWidth(0.1)
  doc.roundedRect(bkX, ftY - 2, bkW, bkBoxH, 2, 2, 'FD')

  // Vertical divider between notes and bank sidebar
  const divBottom = Math.max(ny, ftY - 2 + bkBoxH)
  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3)
  doc.line(divX, ftY - 2, divX, divBottom)

  sectionLabel(bkX + 3, ftY + 4, 'BANK DETAILS')
  let by = ftY + 12
  bkRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');   doc.setFontSize(7.5); doc.setTextColor(...GRAY)
    doc.text(`${label}:`, bkX + 3, by)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
    doc.text(value, bkX + 3 + doc.getTextWidth(`${label}:`) + 1.5, by)
    by += 4.4
  })

  // ── TAGLINE — bullet separators, centred ─────────────────────────
  const tgY = Math.max(ny, ftY - 2 + bkBoxH) + 12
  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3)
  doc.line(lm, tgY - 5, W - rm, tgY - 5)
  const taglineText = TAGLINE.replace(/ \| /g, ' • ')
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...GRAY)
  doc.text(doc.splitTextToSize(taglineText, uw), W / 2, tgY, { align: 'center' })

  // Bottom accent bar — mirrors the top bar
  doc.setFillColor(...BLUE)
  doc.rect(0, H - 3, W, 3, 'F')

  doc.save(`Estimate-${estNum}.pdf`)
}

function ModeToggle({ mode, onChange }) {
  return (
    <div className="flex border border-gray-200 rounded-lg overflow-hidden text-[10px] shrink-0">
      <button type="button" onClick={() => onChange('pick')}
        className={`px-2 py-0.5 transition ${mode === 'pick' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
        Pick
      </button>
      <button type="button" onClick={() => onChange('type')}
        className={`px-2 py-0.5 transition ${mode === 'type' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
        Type
      </button>
    </div>
  )
}

export default function EstimateModal({ open, onClose, selectedInquiries = [], currentUser, company, masterCustomers = [], masterProducts = [], editEstimate = null, onSaved }) {

  const estNum = useRef(generateEstimateNumber())
  const validTillRef = useRef(null)
  const [estimateDate, setEstimateDate] = useState(new Date().toISOString().split('T')[0])

  const [billToMode, setBillToMode] = useState('pick')
  const [billToName, setBillToName] = useState('')
  const [billToAddr1, setBillToAddr1] = useState('')
  const [billToAddr2, setBillToAddr2] = useState('')
  const [billToCountry, setBillToCountry] = useState('')

  const [shipToMode, setShipToMode] = useState('pick')
  const [shipToName, setShipToName] = useState('')
  const [shipToAddr1, setShipToAddr1] = useState('')
  const [shipToAddr2, setShipToAddr2] = useState('')
  const [shipToCountry, setShipToCountry] = useState('')

  const [poNo, setPoNo] = useState('')
  const [payTermsMode, setPayTermsMode] = useState('pick')
  const [payTerms, setPayTerms] = useState('Net 30')
  const [payTermsManual, setPayTermsManual] = useState('')
  const [validTill, setValidTill] = useState('')
  const [incotermsMode, setIncotermsMode] = useState('pick')
  const [incoterms, setIncoterms] = useState('ExW')
  const [incotermsManual, setIncotermsManual] = useState('')
  const [note, setNote] = useState('')

  const [lineItems, setLineItems] = useState([])
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState(null)

  const [coAddress, setCoAddress] = useState('')
  const [coWebsite, setCoWebsite] = useState('')

  const [bankOpen, setBankOpen] = useState(false)
  const [bankBeneficiary, setBankBeneficiary] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAddr, setBankAddr] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankRoutingACH, setBankRoutingACH] = useState('')
  const [bankRoutingWire, setBankRoutingWire] = useState('')
  const [bankSwift, setBankSwift] = useState('')
  const [bankIban, setBankIban] = useState('')

  useEffect(() => {
    if (!open) return

    const cfg = COMPANY_CONFIG[resolveCompany(company)]
    const companyKey = resolveCompany(company)

    function loadCompanyFromDB() {
      supabase.from('company_master').select('*').then(({ data: cmRows }) => {
        const cm = cmRows?.find(row => row.company && resolveCompany(row.company) === companyKey) || null
        if (cm) {
          const addrParts = [cm.address1, cm.address2, cm.city, cm.state, cm.postal_code, cm.country].filter(Boolean)
          setCoAddress(addrParts.join(', '))
          setCoWebsite([cm.website, cm.phone].filter(Boolean).join(' | '))
        } else {
          setCoAddress(cfg.address)
          setCoWebsite(cfg.website)
        }
        setBankBeneficiary(cm?.bank_account_name || '')
        setBankName(cm?.bank_name || '')
        setBankAddr(cm?.bank_address || '')
        setBankAccount(cm?.bank_account_number || '')
        setBankRoutingACH(cm?.bank_routing_number || '')
        setBankRoutingWire(cm?.bank_routing_wire || '')
        setBankSwift(cm?.bank_swift || '')
        setBankIban(cm?.bank_iban || '')
      })
    }

    if (editEstimate) {
      const d = typeof editEstimate.estimate_data === 'string'
        ? JSON.parse(editEstimate.estimate_data)
        : editEstimate.estimate_data

      estNum.current = editEstimate.estimate_number
      setEstimateDate(editEstimate.date || new Date().toISOString().split('T')[0])

      setBillToMode('type'); setBillToName(d.billToName || ''); setBillToAddr1(d.billToAddr1 || ''); setBillToAddr2(d.billToAddr2 || ''); setBillToCountry(d.billToCountry || '')
      setShipToMode('type'); setShipToName(d.shipToName || ''); setShipToAddr1(d.shipToAddr1 || ''); setShipToAddr2(d.shipToAddr2 || ''); setShipToCountry(d.shipToCountry || '')
      setPoNo(d.poNo || '')
      setPayTermsMode('type'); setPayTerms('Net 30'); setPayTermsManual(d.effectivePayTerms || '')
      setValidTill(d.validTill || '')
      setIncotermsMode('type'); setIncoterms('ExW'); setIncotermsManual(d.effectiveIncoterms || '')
      setNote(d.note || '')
      setBankOpen(false)
      setToast(null)
      loadCompanyFromDB()
      setLineItems((d.lineItems || []).map((item, i) => ({ ...item, _key: item._key || `edit-${i}` })))
      return
    }

    estNum.current = generateEstimateNumber()
    setEstimateDate(new Date().toISOString().split('T')[0])
    setBillToMode('pick'); setBillToName(''); setBillToAddr1(''); setBillToAddr2(''); setBillToCountry('')
    setShipToMode('pick'); setShipToName(''); setShipToAddr1(''); setShipToAddr2(''); setShipToCountry('')

    if (selectedInquiries.length > 0 && selectedInquiries[0].customer) {
      const customerName = selectedInquiries[0].customer
      const c = masterCustomers.find(x => x.name === customerName)
      setBillToName(customerName)
      setShipToName(customerName)
      if (c) {
        setBillToAddr1(c.bill_to_address || '')
        setBillToAddr2([c.bill_to_city, c.bill_to_state, c.bill_to_postal_code].filter(Boolean).join(', '))
        setBillToCountry(c.bill_to_country || '')
        setShipToAddr1(c.ship_to_address || '')
        setShipToAddr2([c.ship_to_city, c.ship_to_state, c.ship_to_postal_code].filter(Boolean).join(', '))
        setShipToCountry(c.ship_to_country || '')
      }
    }
    setPoNo(''); setPayTermsMode('pick'); setPayTerms('Net 30'); setPayTermsManual('')
    setValidTill(''); setIncotermsMode('pick'); setIncoterms('ExW'); setIncotermsManual('')
    setNote('')
    setBankOpen(false)
    setToast(null)
    loadCompanyFromDB()

    setLineItems(
      selectedInquiries.map((inq, i) => {
        const prod = masterProducts.find(p => p.name === inq.product)
        return {
          _key: `${inq.id}-${i}`,
          type: 'product',
          item: prod?.product_code || `US-${String(i + 1).padStart(2, '0')}`,
          description: inq.product || '',
          ndcCode: inq.ndc_ma_code || prod?.ndc_ma_code || '',
          packSize: prod?.pack_size || '',
          manufacturer: inq.manufacturer || prod?.manufacturer || '',
          batchNo: '',
          expiry: '',
          htsCode: '',
          qty: String(inq.quantity ?? ''),
          um: 'ea',
          unitPrice: String(inq.quote_price ?? ''),
          currency: inq.currency || 'USD',
        }
      })
    )
  }, [open, company, editEstimate?.id])

  if (!open) return null

  const coKey  = resolveCompany(company)
  const coName = COMPANY_CONFIG[coKey].name
  const coMissingAddress = coKey !== 'Inc' && !coAddress.trim()
  const effectivePayTerms = payTermsMode === 'pick' ? payTerms : payTermsManual
  const effectiveIncoterms = incotermsMode === 'pick' ? incoterms : incotermsManual

  const grandTotal = lineItems.reduce((s, item) => s + (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0), 0)
  const primaryCurrency = lineItems[0]?.currency || 'USD'

  function pickBillTo(name) {
    setBillToName(name)
    const c = masterCustomers.find(x => x.name === name)
    if (c) {
      setBillToAddr1(c.bill_to_address || '')
      setBillToAddr2([c.bill_to_city, c.bill_to_state, c.bill_to_postal_code].filter(Boolean).join(', '))
      setBillToCountry(c.bill_to_country || '')
    }
  }

  function pickShipTo(name) {
    setShipToName(name)
    const c = masterCustomers.find(x => x.name === name)
    if (c) {
      setShipToAddr1(c.ship_to_address || '')
      setShipToAddr2([c.ship_to_city, c.ship_to_state, c.ship_to_postal_code].filter(Boolean).join(', '))
      setShipToCountry(c.ship_to_country || '')
    }
  }

  function updateItem(idx, field, val) {
    setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }

  function addProductRow() {
    setLineItems(prev => [...prev, {
      _key: `extra-${Date.now()}`, type: 'product',
      item: '', description: '', ndcCode: '', packSize: '', manufacturer: '', batchNo: '', expiry: '', htsCode: '',
      qty: '', um: 'ea', unitPrice: '', currency: primaryCurrency,
    }])
  }

  function addChargeRow() {
    setLineItems(prev => [...prev, {
      _key: `charge-${Date.now()}`, type: 'charge',
      item: '', description: '', ndcCode: '', packSize: '', manufacturer: '', batchNo: '', expiry: '', htsCode: '',
      qty: '1', um: '', unitPrice: '', currency: primaryCurrency,
    }])
  }

  function removeItem(idx) { setLineItems(prev => prev.filter((_, i) => i !== idx)) }

  async function handleGeneratePDF() {
    setGenerating(true)
    try {
      const data = {
        estNum: estNum.current,
        today: estimateDate,
        coName,
        coAddress,
        coWebsite,
        salesRepName: currentUser?.name || '',
        billToName, billToAddr1, billToAddr2, billToCountry,
        shipToName, shipToAddr1, shipToAddr2, shipToCountry,
        poNo,
        effectivePayTerms,
        validTill,
        effectiveIncoterms,
        note,
        lineItems,
        grandTotal,
        primaryCurrency,
        bankBeneficiary, bankName, bankAddr, bankAccount,
        bankRoutingACH, bankRoutingWire, bankSwift, bankIban,
      }

      await generateEstimatePDF(data)

      if (editEstimate) {
        const { error: saveError } = await supabase.from('estimates').update({
          customer_name: billToName,
          sales_rep: currentUser?.name,
          valid_till: validTill || null,
          total_amount: grandTotal,
          currency: primaryCurrency,
          estimate_data: JSON.stringify(data),
        }).eq('id', editEstimate.id)

        if (saveError) {
          setToast({ type: 'warning', msg: 'PDF downloaded — could not save changes to database.' })
          setTimeout(() => setToast(null), 4000)
        } else {
          setToast({ type: 'success', msg: 'Estimate updated successfully.' })
          logActivity({ actor: currentUser, company, module: 'Estimates', action: 'edited', recordId: editEstimate.id, details: { customer: billToName } })
          setTimeout(() => { setToast(null); onSaved?.() }, 1500)
        }
      } else {
        const { error: saveError } = await supabase.from('estimates').insert({
          estimate_number: estNum.current,
          company,
          customer_name: billToName,
          sales_rep: currentUser?.name,
          date: estimateDate,
          valid_till: validTill || null,
          total_amount: grandTotal,
          currency: primaryCurrency,
          status: 'Draft',
          estimate_data: JSON.stringify(data),
        })

        if (saveError) {
          setToast({ type: 'warning', msg: 'PDF saved — could not save to database.' })
        } else {
          setToast({ type: 'success', msg: 'Estimate saved successfully.' })
          logActivity({ actor: currentUser, company, module: 'Inquiries', action: 'generated_estimate', details: { customer: billToName, inquiry_count: selectedInquiries.length } })
        }
        setTimeout(() => setToast(null), 4000)
      }
    } finally {
      setGenerating(false)
    }
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.72)' }}
    >
      <div className="flex min-h-full items-start justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl">

          {/* ── Modal Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{editEstimate ? 'Edit Estimate' : 'Generate Estimate'}</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                #{estNum.current} · {formatDateDisplay(estimateDate)} · {coName}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-7">

            {/* ── Auto-filled info ── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Estimate Info</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ['Date', formatDateDisplay(estimateDate)],
                  ['Estimate #', estNum.current],
                  ['Sales Rep', currentUser?.name || '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium">{val}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Company Details ── */}
            <section className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Company Details</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{coName}</p>
              </div>
              <div className="p-4">
                {coMissingAddress ? (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs text-amber-800 bg-amber-50 border border-amber-200">
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    Company address not configured — go to Masters → Company Master to set it up.
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-700">{coAddress}</p>
                    {coWebsite && <p className="text-sm text-gray-400">{coWebsite}</p>}
                  </div>
                )}
              </div>
            </section>

            {/* ── Bill To / Ship To ── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Addresses</p>
              <div className="grid grid-cols-2 gap-5">
                {/* Bill To */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">Customer / Bill To</p>
                    <ModeToggle mode={billToMode} onChange={setBillToMode} />
                  </div>
                  {billToMode === 'pick' ? (
                    <select value={billToName} onChange={e => pickBillTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select customer…</option>
                      {masterCustomers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input value={billToName} onChange={e => setBillToName(e.target.value)} placeholder="Customer name"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                  <div className="mt-2 space-y-2">
                    <input value={billToAddr1} onChange={e => setBillToAddr1(e.target.value)} placeholder="Address line 1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value={billToAddr2} onChange={e => setBillToAddr2(e.target.value)} placeholder="Address line 2"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value={billToCountry} onChange={e => setBillToCountry(e.target.value)} placeholder="Country"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                {/* Ship To */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">Ship To</p>
                    <ModeToggle mode={shipToMode} onChange={setShipToMode} />
                  </div>
                  {shipToMode === 'pick' ? (
                    <select value={shipToName} onChange={e => pickShipTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select customer…</option>
                      {masterCustomers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input value={shipToName} onChange={e => setShipToName(e.target.value)} placeholder="Ship-to name"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                  <div className="mt-2 space-y-2">
                    <input value={shipToAddr1} onChange={e => setShipToAddr1(e.target.value)} placeholder="Address line 1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value={shipToAddr2} onChange={e => setShipToAddr2(e.target.value)} placeholder="Address line 2"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value={shipToCountry} onChange={e => setShipToCountry(e.target.value)} placeholder="Country"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            </section>

            {/* ── Terms & Details ── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Terms &amp; Details</p>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">PO No.</p>
                  <input value={poNo} onChange={e => setPoNo(e.target.value)} placeholder="PO #"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-500">Payment Terms</p>
                    <ModeToggle mode={payTermsMode} onChange={setPayTermsMode} />
                  </div>
                  {payTermsMode === 'pick' ? (
                    <select value={payTerms} onChange={e => setPayTerms(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {PAYMENT_TERMS_OPTIONS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input value={payTermsManual} onChange={e => setPayTermsManual(e.target.value)} placeholder="Terms"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Valid Till</p>
                  <input ref={validTillRef} type="date" value={validTill}
                    onChange={e => setValidTill(e.target.value)} className="sr-only" tabIndex={-1} />
                  <div
                    onClick={() => { validTillRef.current?.showPicker?.() || validTillRef.current?.click() }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 cursor-pointer flex items-center justify-between hover:border-blue-400 transition"
                  >
                    {validTill ? formatDateDisplay(validTill) : <span className="text-gray-400">Select date…</span>}
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-500">Incoterms</p>
                    <ModeToggle mode={incotermsMode} onChange={setIncotermsMode} />
                  </div>
                  {incotermsMode === 'pick' ? (
                    <select value={incoterms} onChange={e => setIncoterms(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {INCOTERMS_OPTIONS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input value={incotermsManual} onChange={e => setIncotermsManual(e.target.value)} placeholder="Incoterms"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Note</p>
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add note…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </section>

            {/* ── Bank Details (read-only, from Company Master) ── */}
            <section className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setBankOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
              >
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank Details</p>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${bankOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {bankOpen && (
                <div className="p-4">
                  {!bankBeneficiary && !bankAccount ? (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs text-amber-800 bg-amber-50 border border-amber-200">
                      <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      Bank details not configured — go to Masters → Company Master to set them up.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                      {[
                        ['Beneficiary Name', bankBeneficiary],
                        ['Bank Name',        bankName],
                        ['Bank Address',     bankAddr],
                        ['Account Number',   bankAccount],
                        ['Routing ACH',      bankRoutingACH],
                        ['Routing Wire',     bankRoutingWire],
                        ['SWIFT',            bankSwift],
                        ['IBAN',             bankIban],
                      ].map(([label, val]) => val ? (
                        <div key={label} className="flex gap-2 items-baseline">
                          <span className="text-xs font-medium text-gray-400 w-32 shrink-0">{label}</span>
                          <span className="text-sm text-gray-700">{val}</span>
                        </div>
                      ) : null)}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Line Items ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Line Items <span className="text-gray-300 normal-case font-normal ml-1">({lineItems.length})</span>
                </p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={addProductRow}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add product
                  </button>
                  <button type="button" onClick={addChargeRow}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add charge
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#1a5fb4' }}>
                      <th className="text-white font-semibold px-2 py-2.5 text-left w-16">ITEM</th>
                      <th className="text-white font-semibold px-2 py-2.5 text-left">DESCRIPTION</th>
                      <th className="text-white font-semibold px-2 py-2.5 text-center w-16">QTY</th>
                      <th className="text-white font-semibold px-2 py-2.5 text-center w-12">U/M</th>
                      <th className="text-white font-semibold px-2 py-2.5 text-right w-28">UNIT PRICE</th>
                      <th className="text-white font-semibold px-2 py-2.5 text-right w-24">TOTAL</th>
                      <th className="w-8 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const qty = parseFloat(item.qty) || 0
                      const up  = parseFloat(item.unitPrice) || 0
                      const tot = qty * up
                      const isCharge = item.type === 'charge'
                      const rowBg = isCharge
                        ? 'bg-slate-100/60'
                        : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60')
                      return (
                        <tr key={item._key} className={rowBg}>
                          <td className="px-2 py-2 border-t border-gray-100 align-top">
                            {isCharge ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-500 uppercase tracking-wide">Charge</span>
                            ) : (
                              <input value={item.item} onChange={e => updateItem(idx, 'item', e.target.value)}
                                className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            )}
                          </td>
                          <td className="px-2 py-2 border-t border-gray-100 align-top">
                            <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            {!isCharge && (
                              <div className="grid grid-cols-3 gap-1 mt-1.5">
                                {[['ndcCode','NDC#'],['packSize','Pack Size'],['manufacturer','Manufacturer'],['batchNo','Batch#'],['expiry','Expiry'],['htsCode','HTS Code']].map(([f, ph]) => (
                                  <input key={f} value={item[f]} onChange={e => updateItem(idx, f, e.target.value)}
                                    placeholder={ph}
                                    className="px-1.5 py-0.5 border border-gray-100 rounded text-[10px] text-gray-500 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-gray-50/70" />
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 border-t border-gray-100 align-top text-center text-gray-400 text-xs">
                            {isCharge ? '—' : (
                              <input value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)}
                                className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            )}
                          </td>
                          <td className="px-2 py-2 border-t border-gray-100 align-top text-center text-gray-400 text-xs">
                            {isCharge ? '—' : (
                              <input value={item.um} onChange={e => updateItem(idx, 'um', e.target.value)}
                                className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            )}
                          </td>
                          <td className="px-2 py-2 border-t border-gray-100 align-top">
                            <input value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                              placeholder={isCharge ? 'Amount' : ''}
                              className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-3 py-2 border-t border-gray-100 text-right align-top font-medium text-gray-700">
                            {tot > 0 ? `${item.currency} ${tot.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-1 py-2 border-t border-gray-100 align-top">
                            <button type="button" onClick={() => removeItem(idx)}
                              className="text-red-400 hover:text-red-600 p-0.5 rounded transition">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#dbeafe' }}>
                      <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-bold text-blue-800">TOTAL</td>
                      <td className="px-3 py-2.5 text-right text-sm font-bold text-blue-800">
                        {primaryCurrency} {grandTotal.toFixed(2)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>

          {/* ── Modal Footer ── */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
            <div className="flex-1">
              {toast && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg w-fit ${
                  toast.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {toast.type === 'success' ? (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  )}
                  {toast.msg}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="button" onClick={handleGeneratePDF} disabled={generating}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-60"
                style={{ background: '#1a5fb4' }}>
                {generating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    {editEstimate ? 'Saving…' : 'Generating…'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {editEstimate ? 'Save & Download PDF' : 'Generate PDF'}
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
