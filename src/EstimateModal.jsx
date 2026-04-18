import { useState, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import { supabase } from './supabase'

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
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

  function heading(x, y, text, size) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(size || 9.5)
    doc.setTextColor(...BLUE)
    doc.text(text, x, y)
    doc.setDrawColor(...BLUE)
    doc.setLineWidth(0.4)
    doc.line(x, y + 1.3, x + doc.getTextWidth(text), y + 1.3)
  }

  function bodyText(x, y, text, color, size) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size || 8.5)
    doc.setTextColor(...(color || DARK))
    doc.text(text, x, y)
  }

  // ── TOP HEADER ──────────────────────────────────────────────────────
  const logoDataURL = await loadLogoDataURL()

  if (logoDataURL) {
    doc.addImage(logoDataURL, 'PNG', lm, 7, 70, 24)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...BLUE)
    doc.text('JUPITER RESEARCH SERVICES', lm, 21)
  }

  const rX = W - rm
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...DARK)
  doc.text(coName, rX, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  const addrWrapped = doc.splitTextToSize(coAddress || '', 90)
  let coY = 18
  addrWrapped.forEach(ln => { doc.text(ln, rX, coY, { align: 'right' }); coY += 4 })
  if (coWebsite) doc.text(coWebsite, rX, coY, { align: 'right' })

  doc.setDrawColor(...LGRAY)
  doc.setLineWidth(0.4)
  doc.line(lm, 35, W - rm, 35)

  doc.setFont('helvetica', 'bolditalic')
  doc.setFontSize(20)
  doc.setTextColor(...BLUE)
  doc.text('ESTIMATE', lm, 44)

  // ── CUSTOMER & QUOTE DETAILS ─────────────────────────────────────
  const secY = 55

  let leftY = secY
  heading(lm, leftY, 'CUSTOMER ADDRESS')
  leftY += 7
  if (billToName) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK)
    doc.text(billToName, lm, leftY); leftY += 5
  }
  ;[billToAddr1, billToAddr2, billToCountry].filter(Boolean).forEach(ln => {
    bodyText(lm, leftY, ln, GRAY, 8); leftY += 4.5
  })

  leftY += 9

  heading(lm, leftY, 'SHIPPING ADDRESS')
  leftY += 7
  if (shipToName) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK)
    doc.text(shipToName, lm, leftY); leftY += 5
  }
  ;[shipToAddr1, shipToAddr2, shipToCountry].filter(Boolean).forEach(ln => {
    bodyText(lm, leftY, ln, GRAY, 8); leftY += 4.5
  })

  const rcX = 110
  let rightY = secY
  heading(rcX, rightY, 'SALES QUOTE')
  rightY += 8

  const PILL_W = 43, PILL_H = 5.5, PILL_GAP = 2.8, PILL_R = 1.3

  const pillRows = [
    ['ESTIMATE #',    estNum],
    ['DATE',          formatDateDisplay(today)],
    ['SALES REP',     salesRepName],
    validTill          ? ['VALID TILL',     formatDateDisplay(validTill)] : null,
    effectiveIncoterms ? ['INCOTERMS',       effectiveIncoterms]          : null,
    effectivePayTerms  ? ['PAYMENT TERMS',   effectivePayTerms]           : null,
    poNo               ? ['PO NO.',           poNo]                       : null,
    note               ? ['NOTE',             note]                       : null,
  ].filter(Boolean)

  pillRows.forEach(([label, value]) => {
    doc.setFillColor(...BLUE)
    doc.roundedRect(rcX, rightY, PILL_W, PILL_H, PILL_R, PILL_R, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...WHITE)
    doc.text(label, rcX + PILL_W / 2, rightY + PILL_H * 0.69, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...DARK)
    doc.text(String(value), rcX + PILL_W + 4, rightY + PILL_H * 0.72)
    rightY += PILL_H + PILL_GAP
  })

  // ── LINE ITEMS TABLE ─────────────────────────────────────────────
  const tY = Math.max(leftY, rightY) + 7

  const cw      = [12, 84, 15, 13, 29, 29]
  const cLabels = ['LINE', 'CODE & DESCRIPTION', 'QTY', 'U/M', 'UNIT PRICE', 'TOTAL']
  const thH     = 8

  function drawTableHeader(y) {
    doc.setFillColor(...BLUE)
    doc.rect(lm, y, uw, thH, 'F')
    let tx = lm
    cLabels.forEach((lbl, i) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...WHITE)
      doc.text(lbl, tx + cw[i] / 2, y + 5.5, { align: 'center' })
      tx += cw[i]
    })
  }

  drawTableHeader(tY)

  const SUB_H     = 4.5
  const SUB_LBL_W = 16
  const SUB_CPR   = 4
  const subPairW  = uw / SUB_CPR

  let ry = tY + thH

  lineItems.forEach((item, idx) => {
    const qty = parseFloat(item.qty) || 0
    const up  = parseFloat(item.unitPrice) || 0
    const tot = qty * up

    const descLines = doc.splitTextToSize(item.description || '', cw[1] - 4)
    const mainH     = Math.max(10, descLines.length * 4.5 + 5)

    const subFields = [
      item.ndcCode  && ['NDC/MA',    item.ndcCode],
      item.packSize && ['Pack Size', item.packSize],
      item.lotNo    && ['Lot #',     item.lotNo],
      item.batchNo  && ['Batch #',   item.batchNo],
      item.expiry   && ['Expiry',    item.expiry],
      item.htsCode  && ['HTS Code',  item.htsCode],
    ].filter(Boolean)

    const subRowCount = subFields.length > 0 ? Math.ceil(subFields.length / SUB_CPR) : 0
    const subTotalH   = subRowCount > 0 ? subRowCount * (SUB_H + 0.5) + 2 : 0
    const itemH       = mainH + subTotalH

    if (ry + itemH > H - 68) {
      doc.addPage()
      ry = 16
      drawTableHeader(ry)
      ry += thH
    }

    doc.setFillColor(...(idx % 2 === 0 ? [255, 255, 255] : [250, 252, 255]))
    doc.rect(lm, ry, uw, mainH, 'F')

    const midY = ry + mainH / 2 + 1.5
    const c2x  = lm + cw[0]
    const c3x  = c2x + cw[1]
    const c4x  = c3x + cw[2]
    const c5x  = c4x + cw[3]
    const c6x  = c5x + cw[4]

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...BLUE)
    doc.text(String(idx + 1), lm + cw[0] / 2, midY, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...DARK)
    let dy = ry + 4.5
    descLines.forEach(ln => { doc.text(ln, c2x + 2, dy); dy += 4.5 })
    if (item.item) {
      doc.setFontSize(6.5)
      doc.setTextColor(...GRAY)
      doc.text(item.item, c2x + 2, dy)
    }

    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
    doc.text(String(item.qty || ''), c3x + cw[2] / 2, midY, { align: 'center' })
    doc.text(item.um || '',          c4x + cw[3] / 2, midY, { align: 'center' })

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
        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); doc.setTextColor(50, 70, 130)
        doc.text(label, sx + 1.5, sy + SUB_H * 0.73)
        doc.setFillColor(...SVAL)
        doc.rect(sx + SUB_LBL_W, sy, valW, SUB_H, 'F')
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(...DARK)
        doc.text(String(value).substring(0, 16), sx + SUB_LBL_W + 1.5, sy + SUB_H * 0.73)
        sx += subPairW
      })
      ry += subTotalH
    }

    doc.setDrawColor(...LGRAY)
    doc.setLineWidth(0.2)
    doc.line(lm, ry, W - rm, ry)
  })

  // ── TOTAL ROW ────────────────────────────────────────────────────
  ry += 5
  const c5xTotal = lm + cw[0] + cw[1] + cw[2] + cw[3] + cw[4]
  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3)
  doc.line(c5xTotal, ry - 3, W - rm, ry - 3)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...BLUE)
  doc.text('TOTAL',                             c5xTotal - 2, ry + 4, { align: 'right' })
  doc.text(`${primaryCurrency} ${grandTotal.toFixed(2)}`, W - rm - 2, ry + 4, { align: 'right' })
  ry += 12

  // ── FOOTER ───────────────────────────────────────────────────────
  const ftY = ry
  const nW  = 105
  const bkX = lm + nW + 8
  const bkW = uw - nW - 8

  heading(lm, ftY, 'NOTES')
  let ny = ftY + 6
  FOOTER_NOTES.forEach(n => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...DARK)
    doc.splitTextToSize(n, nW - 2).forEach(ln => { doc.text(ln, lm, ny); ny += 3.6 })
    ny += 1
  })

  heading(bkX, ftY, 'BANK DETAILS')
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

  let by = ftY + 6
  bkRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');   doc.setFontSize(7.5); doc.setTextColor(...GRAY)
    doc.text(`${label}:`, bkX, by)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
    doc.text(value, bkX + doc.getTextWidth(`${label}:`) + 1.5, by)
    by += 4.2
  })

  // ── TAGLINE ──────────────────────────────────────────────────────
  const tgY = Math.max(ny, by) + 9
  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3)
  doc.line(lm, tgY - 3, W - rm, tgY - 3)
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...GRAY)
  doc.text(doc.splitTextToSize(TAGLINE, uw), W / 2, tgY, { align: 'center' })

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

export default function EstimateModal({ open, onClose, selectedInquiries = [], currentUser, company, masterCustomers = [] }) {
  console.log('[EstimateModal] company prop:', company, '→ resolved key:', resolveCompany(company))

  const estNum = useRef(generateEstimateNumber())
  const today = new Date().toISOString().split('T')[0]

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
    estNum.current = generateEstimateNumber()
    setBillToMode('pick'); setBillToName(''); setBillToAddr1(''); setBillToAddr2(''); setBillToCountry('')
    setShipToMode('pick'); setShipToName(''); setShipToAddr1(''); setShipToAddr2(''); setShipToCountry('')
    setPoNo(''); setPayTermsMode('pick'); setPayTerms('Net 30'); setPayTermsManual('')
    setValidTill(''); setIncotermsMode('pick'); setIncoterms('ExW'); setIncotermsManual('')
    setNote('')
    setBankOpen(false)
    setToast(null)

    const cfg = COMPANY_CONFIG[resolveCompany(company)]
    setCoAddress(cfg.address)
    setCoWebsite(cfg.website)
    setBankBeneficiary(cfg.bank.beneficiary)
    setBankName(cfg.bank.bank)
    setBankAddr(cfg.bank.address)
    setBankAccount(cfg.bank.account)
    setBankRoutingACH(cfg.bank.routingACH)
    setBankRoutingWire(cfg.bank.routingWire)
    setBankSwift(cfg.bank.swift)
    setBankIban(cfg.bank.iban)

    setLineItems(
      selectedInquiries.map((inq, i) => ({
        _key: `${inq.id}-${i}`,
        item: `US-${String(i + 1).padStart(2, '0')}`,
        description: [inq.product, inq.manufacturer].filter(Boolean).join(' / '),
        ndcCode: inq.ndc_ma_code || '',
        packSize: '',
        lotNo: '',
        batchNo: '',
        expiry: '',
        htsCode: '',
        qty: String(inq.quantity ?? ''),
        um: 'ea',
        unitPrice: String(inq.quote_price ?? ''),
        currency: inq.currency || 'USD',
      }))
    )
  }, [open, company])

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
    if (c) { setBillToAddr1(c.address1 || ''); setBillToAddr2(c.address2 || ''); setBillToCountry(c.country || '') }
  }

  function pickShipTo(name) {
    setShipToName(name)
    const c = masterCustomers.find(x => x.name === name)
    if (c) { setShipToAddr1(c.address1 || ''); setShipToAddr2(c.address2 || ''); setShipToCountry(c.country || '') }
  }

  function updateItem(idx, field, val) {
    setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }

  function addItem() {
    setLineItems(prev => [...prev, {
      _key: `extra-${Date.now()}`,
      item: '', description: '', ndcCode: '', packSize: '', lotNo: '', batchNo: '', expiry: '', htsCode: '',
      qty: '', um: 'ea', unitPrice: '', currency: primaryCurrency,
    }])
  }

  function removeItem(idx) { setLineItems(prev => prev.filter((_, i) => i !== idx)) }

  async function handleGeneratePDF() {
    setGenerating(true)
    try {
      const data = {
        estNum: estNum.current,
        today,
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

      const { error: saveError } = await supabase.from('estimates').insert({
        estimate_number: estNum.current,
        company,
        customer_name: billToName,
        sales_rep: currentUser?.name,
        date: today,
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
      }
      setTimeout(() => setToast(null), 4000)
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
              <h2 className="text-xl font-bold text-gray-900">Generate Estimate</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                #{estNum.current} · {formatDateDisplay(today)} · {coName}
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
                  ['Date', formatDateDisplay(today)],
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
                {coKey === 'Inc' ? (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-700">{coAddress}</p>
                    {coWebsite && <p className="text-sm text-gray-400">{coWebsite}</p>}
                  </div>
                ) : (
                  <>
                    {coMissingAddress && (
                      <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg text-xs text-amber-800 bg-amber-50 border border-amber-200">
                        <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        Company address not configured for this entity — please fill in before generating.
                      </div>
                    )}
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Company Address</p>
                        <textarea
                          value={coAddress}
                          onChange={e => setCoAddress(e.target.value)}
                          placeholder="Enter company address…"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Website / Phone</p>
                        <input
                          value={coWebsite}
                          onChange={e => setCoWebsite(e.target.value)}
                          placeholder="e.g. www.example.com | +1 000 000 0000"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </>
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
                  <input type="date" value={validTill} onChange={e => setValidTill(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

            {/* ── Bank Details (collapsible) ── */}
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
                <div className="p-4 grid grid-cols-2 gap-3">
                  {[
                    ['Beneficiary Name', bankBeneficiary, setBankBeneficiary],
                    ['Bank Name',        bankName,        setBankName],
                    ['Bank Address',     bankAddr,        setBankAddr],
                    ['Account Number',   bankAccount,     setBankAccount],
                    ['Routing ACH',      bankRoutingACH,  setBankRoutingACH],
                    ['Routing Wire',     bankRoutingWire, setBankRoutingWire],
                    ['SWIFT',            bankSwift,       setBankSwift],
                    ['IBAN',             bankIban,        setBankIban],
                  ].map(([label, val, setter]) => (
                    <div key={label}>
                      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                      <input
                        value={val}
                        onChange={e => setter(e.target.value)}
                        placeholder={label}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Line Items ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Line Items <span className="text-gray-300 normal-case font-normal ml-1">({lineItems.length})</span>
                </p>
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add row
                </button>
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
                      return (
                        <tr key={item._key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="px-2 py-2 border-t border-gray-100 align-top">
                            <input value={item.item} onChange={e => updateItem(idx, 'item', e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-2 py-2 border-t border-gray-100 align-top">
                            <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 mb-1.5" />
                            <div className="grid grid-cols-3 gap-1">
                              {[['ndcCode','NDC#'],['packSize','Pack Size'],['lotNo','Lot#'],['batchNo','Batch#'],['expiry','Expiry'],['htsCode','HTS Code']].map(([f, ph]) => (
                                <input key={f} value={item[f]} onChange={e => updateItem(idx, f, e.target.value)}
                                  placeholder={ph}
                                  className="px-1.5 py-0.5 border border-gray-100 rounded text-[10px] text-gray-500 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-gray-50/70" />
                              ))}
                            </div>
                          </td>
                          <td className="px-2 py-2 border-t border-gray-100 align-top">
                            <input value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-2 py-2 border-t border-gray-100 align-top">
                            <input value={item.um} onChange={e => updateItem(idx, 'um', e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-2 py-2 border-t border-gray-100 align-top">
                            <input value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
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
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Generate PDF
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
