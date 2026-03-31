import { useState } from 'react';
import { Phone, Mail, MapPin, MessageSquare, Edit2, Check, X, AlertCircle, Building2 } from 'lucide-react';
import { PATHWAY_OPTIONS, normalizePhone, MESSAGE_TEMPLATES } from '../data/contactPathway';

const PREFERRED_METHODS = ['Phone Call', 'SMS', 'WhatsApp', 'Email'];

// Inline editable field — shows value with hover-to-edit pencil icon.
function EditableField({ label, value, onChange, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  const save = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value || ''); setEditing(false); };

  return (
    <div>
      <p className="text-xs text-gray-400 uppercase font-medium tracking-wide mb-0.5">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            placeholder={placeholder}
            className="flex-1 min-w-0 border border-teal-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button onClick={save}   className="p-1 rounded text-teal-600 hover:bg-teal-50 shrink-0"><Check size={13} /></button>
          <button onClick={cancel} className="p-1 rounded text-gray-400 hover:bg-gray-50 shrink-0"><X size={13} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 group">
          <p className={`text-sm ${value ? 'text-gray-900' : 'text-gray-400 italic'}`}>
            {value || placeholder || '—'}
          </p>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-teal-600 transition-opacity shrink-0"
          >
            <Edit2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, icon: Icon, href, target = '_self', disabled = false, variant = 'default' }) {
  const base = 'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const styles = {
    default: 'border-gray-200 text-gray-700 hover:bg-gray-50',
    blue:    'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
    green:   'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
    teal:    'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100',
  };
  return (
    <a
      href={disabled ? undefined : href}
      target={disabled ? undefined : target}
      rel="noopener noreferrer"
      onClick={disabled ? e => e.preventDefault() : undefined}
      className={`${base} ${styles[variant]} ${disabled ? 'pointer-events-none opacity-40' : ''}`}
    >
      <Icon size={14} />
      {label}
    </a>
  );
}

export default function ContactInfoPanel({ patient, onUpdateContactPathway, onUpdateContactDetails }) {
  const pathway  = patient.contactPathway || 'none';
  const phone    = patient.phone    || '';
  const email    = patient.email    || '';
  const address  = patient.address  || '';
  const preferred = patient.preferredContactMethod || (phone ? 'Phone Call' : email ? 'Email' : 'Phone Call');

  const normalizedPhone = normalizePhone(phone);
  const waPhone  = normalizedPhone ? normalizedPhone.replace(/^\+/, '').replace(/\D/g, '') : null;

  const callLink = normalizedPhone ? `tel:${normalizedPhone}` : null;
  const smsLink  = normalizedPhone
    ? `sms:${normalizedPhone}?body=${encodeURIComponent(MESSAGE_TEMPLATES.sms(patient.id))}`
    : null;
  const waLink   = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(MESSAGE_TEMPLATES.whatsapp(patient.id))}`
    : null;
  const mailLink = email
    ? `mailto:${email}?subject=${encodeURIComponent(MESSAGE_TEMPLATES.emailSubject())}&body=${encodeURIComponent(MESSAGE_TEMPLATES.emailBody(patient.id))}`
    : null;

  const isDirect   = pathway === 'direct' || pathway === 'both';
  const isProvider = pathway === 'provider' || pathway === 'both';
  const isNone     = pathway === 'none';

  const update = (field) => (value) => onUpdateContactDetails(patient.id, { [field]: value });

  return (
    <div>
      {/* Section header + pathway override */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact Information</h3>
        <select
          value={pathway}
          onChange={e => onUpdateContactPathway(patient.id, e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {PATHWAY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* No contact method warning */}
      {isNone && (
        <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
          <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">No contact information available</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Add contact details below or change the pathway using the dropdown above.
            </p>
          </div>
        </div>
      )}

      {/* Direct contact details */}
      {(isDirect || isNone) && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 space-y-3">
          {isDirect && (
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
              <Phone size={11} /> Direct Patient Contact
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditableField label="Phone"  value={phone}   onChange={update('phone')}   placeholder="Add phone number" />
            <EditableField label="Email"  value={email}   onChange={update('email')}   placeholder="Add email address" />
          </div>
          <EditableField label="Address" value={address} onChange={update('address')} placeholder="Add address" />
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium tracking-wide mb-1">Preferred Method</p>
            <select
              value={preferred}
              onChange={e => onUpdateContactDetails(patient.id, { preferredContactMethod: e.target.value })}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {PREFERRED_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          {isDirect && (
            <div className="pt-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <ActionButton label="Call"     icon={Phone}          href={callLink} disabled={!callLink} />
              <ActionButton label="SMS"      icon={MessageSquare}  href={smsLink}  disabled={!smsLink}  variant="blue" />
              <ActionButton label="WhatsApp" icon={MessageSquare}  href={waLink}   target="_blank" disabled={!waLink} variant="green" />
              <ActionButton label="Email"    icon={Mail}           href={mailLink} target="_blank" disabled={!mailLink} variant="teal" />
            </div>
          )}
        </div>
      )}

      {/* Provider mediated note */}
      {isProvider && (
        <div className={`${isDirect ? 'mt-3' : ''} bg-teal-50/50 border border-teal-100 rounded-lg p-4`}>
          <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Building2 size={11} /> Provider-Mediated Contact
          </p>
          <p className="text-sm text-gray-600">
            Use the <span className="font-medium">Email Provider</span> button to contact the assigned provider.
            The provider will then reach out to the patient on behalf of the study team.
          </p>
        </div>
      )}
    </div>
  );
}
