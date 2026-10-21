import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Upload,
  CloudUpload,
  FileSpreadsheet,
  Check,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Trash2,
  Users,
  ShieldCheck,
  LoaderCircle,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  uploadImport,
  getPreview,
  saveMapping,
  validateImport,
  executeImport,
  getImportStatus,
  downloadTemplate,
  downloadImportErrors,
  savePreset,
  listPresets
} from '../services/imports';

const CRM_FIELDS = [
  ['', '— Ignore Column —'],
  ['fullName', 'Full Name *'],
  ['phoneNumber', 'WhatsApp Number *'],
  ['alternatePhone', 'Alternate Phone'],
  ['email', 'Email Address'],
  ['city', 'City'],
  ['state', 'State'],
  ['interestedPropertyType', 'Property Interest Type'],
  ['interestedProject', 'Project / Community'],
  ['preferredLocation', 'Preferred Location'],
  ['budgetRange', 'Budget Range'],
  ['leadSource', 'Enquiry Source'],
  ['leadStatus', 'Lead Status'],
  ['priority', 'Priority'],
  ['preferredContactTime', 'Preferred Contact Time'],
  ['notes', 'Internal Notes'],
  ['tags', 'Tags']
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const errMessage = (e) => e.response?.data?.message || e.message || 'Something went wrong.';

export default function ImportWizardModal({ onClose, onImportCompleted }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sheet, setSheet] = useState('');
  const [mapping, setMapping] = useState({});
  const [options, setOptions] = useState({
    defaultCountry: 'IN',
    duplicateMode: 'skip',
    batchName: '',
    tagsText: '',
    updateFields: ['city', 'state', 'interestedPropertyType', 'interestedProject', 'preferredLocation', 'budgetRange', 'notes']
  });
  const [summary, setSummary] = useState(null);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    listPresets()
      .then(({ data }) => setPresets(data.presets || []))
      .catch(() => {});
  }, []);

  const handleChooseFile = (f) => {
    if (!f) return;
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
    if (!['.xlsx', '.csv'].includes(ext)) {
      toast.error('Only .xlsx and .csv files are supported. Legacy .xls is not supported.');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds the 10 MB limit.');
      return;
    }
    setFile(f);
  };

  const doUpload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const { data } = await uploadImport(file);
      setJob(data.job);
      setSheet(data.job.selectedSheet);
      setMapping(data.job.columnMappings || {});
      setOptions((o) => ({ ...o, batchName: data.job.batchName }));

      const p = await getPreview(data.job._id);
      setPreview(p.data);
      setStep(2);
      toast.success('Spreadsheet loaded and columns inspected.');
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSheetChange = async (sheetName) => {
    setSheet(sheetName);
    try {
      const { data } = await getPreview(job._id, { sheet: sheetName });
      setPreview(data);
      setMapping(data.suggestedMappings || {});
    } catch (err) {
      toast.error(errMessage(err));
    }
  };

  const updateMappingField = (header, crmField) => {
    setMapping((prev) => ({ ...prev, [header]: crmField }));
  };

  const mappedValues = Object.values(mapping).filter(Boolean);
  const duplicateMapping = useMemo(() => {
    return mappedValues.filter((x) => !x.startsWith('custom:')).find((x, i) => mappedValues.indexOf(x) !== i);
  }, [mapping]);

  const handleApplyPreset = (preset) => {
    if (!preset?.mappings) return;
    setMapping((prev) => ({ ...prev, ...preset.mappings }));
    if (preset.defaultCountry) {
      setOptions((o) => ({ ...o, defaultCountry: preset.defaultCountry }));
    }
    toast.success(`Applied mapping preset "${preset.name}".`);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error('Enter a name for the mapping preset.');
      return;
    }
    try {
      const { data } = await savePreset({
        name: presetName.trim(),
        mappings: mapping,
        defaultCountry: options.defaultCountry
      });
      setPresets((prev) => {
        const filtered = prev.filter((p) => p.name !== data.preset.name);
        return [...filtered, data.preset];
      });
      setPresetName('');
      toast.success('Mapping preset saved for future imports.');
    } catch (err) {
      toast.error(errMessage(err));
    }
  };

  const handleProceedToDuplicates = () => {
    if (duplicateMapping) {
      toast.error(`Field "${duplicateMapping}" is mapped to multiple columns. Map each CRM field at most once.`);
      return;
    }
    if (!mappedValues.includes('fullName') || !mappedValues.includes('phoneNumber')) {
      toast.error('Both "Full Name" and "WhatsApp Number" must be mapped to continue.');
      return;
    }
    setStep(3);
  };

  const handleValidateAndPreview = async () => {
    setBusy(true);
    try {
      const payload = {
        selectedSheet: sheet,
        columnMappings: mapping,
        importOptions: {
          ...options,
          tags: options.tagsText.split(',').map((t) => t.trim()).filter(Boolean)
        }
      };

      await saveMapping(job._id, payload);
      const { data } = await validateImport(job._id);
      setJob(data.job);
      setSummary(data.summary);

      const p = await getPreview(job._id);
      setPreview(p.data);
      setStep(4);
      toast.success('Validation completed. Review summary before importing.');
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const waitForCompletion = async (id) => {
    for (let i = 0; i < 600; i++) {
      await new Promise((r) => setTimeout(r, 600));
      const { data } = await getImportStatus(id);
      setJob(data.job);
      if (['Completed', 'Completed With Errors', 'Failed', 'Cancelled'].includes(data.job.status)) {
        return data.job;
      }
    }
    throw new Error('Import is still processing in the background.');
  };

  const doExecute = async () => {
    setBusy(true);
    try {
      await executeImport(job._id);
      const finishedJob = await waitForCompletion(job._id);
      setJob(finishedJob);
      setStep(5);
      toast.success('Import completed successfully!');
      if (onImportCompleted) onImportCompleted(finishedJob);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadSample = async () => {
    try {
      await downloadTemplate();
      toast.success('Sample Real Estate import template downloaded');
    } catch {
      toast.error('Failed to download template');
    }
  };

  const STEPS = ['Upload File', 'Map Columns', 'Duplicates & Rules', 'Validate & Preview', 'Import Results'];

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section className="contact-modal" role="dialog" aria-modal="true" style={{ maxWidth: '820px' }}>
        <header className="contact-modal-head">
          <div>
            <span className="form-kicker">SMART SPREADSHEET ENGINE</span>
            <h2>Import Property Contacts</h2>
            <p>Upload Excel or CSV contact lists with phone normalization and duplicate prevention.</p>
          </div>
          <button className="icon-btn modal-close" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {/* Stepper Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '12px 24px', background: 'var(--color-surface-muted)', gap: '16px', overflowX: 'auto' }}>
          {STEPS.map((s, i) => {
            const stepNum = i + 1;
            const isCurrent = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: isCurrent || isDone ? 1 : 0.5 }}>
                <span
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: isDone ? 'var(--color-primary)' : isCurrent ? 'var(--color-primary-soft)' : 'var(--color-border)',
                    color: isDone ? '#fff' : isCurrent ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                >
                  {isDone ? <Check size={12} /> : stepNum}
                </span>
                <span style={{ fontSize: '12px', fontWeight: isCurrent ? 600 : 500, color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>

        <div className="contact-form-scroll" style={{ maxHeight: 'calc(85vh - 160px)', overflowY: 'auto', padding: '20px 24px' }}>
          
          {/* STEP 1: UPLOAD */}
          {step === 1 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  Accepts <b>.xlsx</b> and <b>.csv</b> workbooks up to 10 MB.
                </span>
                <button type="button" className="outline-btn small" onClick={downloadSample}>
                  <Download size={13} /> Download Sample Excel Template
                </button>
              </div>

              <div
                className={`drop-zone ${drag ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  handleChooseFile(e.dataTransfer.files?.[0]);
                }}
                style={{
                  border: '2px dashed var(--color-border)',
                  borderRadius: '12px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: drag ? 'var(--color-primary-soft)' : 'var(--color-surface-muted)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--color-primary)', boxShadow: 'var(--shadow-xs)' }}>
                  <CloudUpload size={24} />
                </div>
                <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)', display: 'block', marginBottom: '4px' }}>
                  Drag & drop your property contacts file here
                </strong>
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '14px' }}>
                  or click below to browse from your device
                </span>
                <label className="outline-btn small" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                  Browse Files
                  <input type="file" accept=".xlsx,.csv" hidden onChange={(e) => handleChooseFile(e.target.files?.[0])} />
                </label>
              </div>

              {file && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-primary-border)', borderRadius: '8px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileSpreadsheet size={24} color="var(--color-primary)" />
                    <div>
                      <strong style={{ fontSize: '13.5px', display: 'block' }}>{file.name}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                  <button className="icon-btn text-danger" onClick={() => setFile(null)} title="Remove file">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              {/* Zero-Policy Notice */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'var(--color-surface-muted)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', marginTop: '16px' }}>
                <ShieldCheck size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  <b>Consent Zero-Policy Reminder:</b> Importing contacts never generates verified WhatsApp marketing consent. Every contact defaults strictly to <b>Unknown</b>. A spreadsheet column marked "Yes" is ignored for verified opt-in.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: MAP COLUMNS */}
          {step === 2 && preview && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Smart Column Recognition</h3>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Found {preview.headers?.length || 0} headers and {preview.totalRows || 0} rows. Match each header to a CRM field.
                  </span>
                </div>
                {job?.sheetNames?.length > 1 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    Sheet:
                    <select value={sheet} onChange={(e) => handleSheetChange(e.target.value)} style={{ height: '30px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                      {job.sheetNames.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                )}
              </div>

              {/* Mapping Preset Selector & Saver */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', background: 'var(--color-surface-muted)', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Mapping Preset:</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const found = presets.find((p) => p._id === e.target.value);
                      if (found) handleApplyPreset(found);
                    }}
                    style={{ height: '30px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', background: '#fff' }}
                  >
                    <option value="">Load saved preset...</option>
                    {presets.map((p) => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="New preset name..."
                    style={{ height: '30px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', padding: '0 8px', width: '160px' }}
                  />
                  <button type="button" className="outline-btn small" onClick={handleSavePreset} disabled={!presetName.trim()}>
                    Save Preset
                  </button>
                </div>
              </div>

              {/* Mapping table */}
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Excel Header</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Sample Value</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Map to CRM Field</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, width: '90px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.headers || []).map((header) => {
                      const sample = preview.sampleRow?.[header] || '—';
                      const currentField = mapping[header] || '';
                      return (
                        <tr key={header} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{header}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(sample)}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={currentField}
                              onChange={(e) => updateMappingField(header, e.target.value)}
                              style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', background: '#fff' }}
                            >
                              {CRM_FIELDS.map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                              <option value={`custom:${header}`}>Custom Field: {header}</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {currentField ? (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-success)', background: 'var(--color-success-soft)', padding: '2px 6px', borderRadius: '4px' }}>
                                Mapped
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'var(--color-surface-muted)', padding: '2px 6px', borderRadius: '4px' }}>
                                Ignored
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Default metadata settings */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
                <label className="field">
                  Default Country Code
                  <select value={options.defaultCountry} onChange={(e) => setOptions((o) => ({ ...o, defaultCountry: e.target.value }))}>
                    <option value="IN">India (+91)</option>
                    <option value="AE">UAE (+971)</option>
                    <option value="US">United States (+1)</option>
                    <option value="GB">United Kingdom (+44)</option>
                    <option value="SG">Singapore (+65)</option>
                  </select>
                </label>
                <label className="field">
                  Batch Label
                  <input
                    value={options.batchName}
                    onChange={(e) => setOptions((o) => ({ ...o, batchName: e.target.value }))}
                    placeholder="e.g. DLF Privana Expo Leads"
                  />
                </label>
                <label className="field">
                  Tags for Imported Contacts
                  <input
                    value={options.tagsText}
                    onChange={(e) => setOptions((o) => ({ ...o, tagsText: e.target.value }))}
                    placeholder="excel-import, gurugram, nri"
                  />
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: DUPLICATE CONFIGURATION */}
          {step === 3 && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 600 }}>Duplicate Policy & Protection</h3>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                  Relay identifies existing contacts using their <b>normalized E.164 WhatsApp number</b>. Choose how matching records should be handled:
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { mode: 'skip', title: 'Skip Duplicates', desc: 'Preserves existing contact records completely. Recommended for safe imports.' },
                  { mode: 'update', title: 'Update Existing', desc: 'Updates selected property and contact fields on existing contacts.' },
                  { mode: 'new', title: 'Import Only New', desc: 'Only inserts completely new contacts; ignores any phone numbers already present.' }
                ].map((item) => (
                  <div
                    key={item.mode}
                    onClick={() => setOptions((o) => ({ ...o, duplicateMode: item.mode }))}
                    style={{
                      border: options.duplicateMode === item.mode ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '14px',
                      background: options.duplicateMode === item.mode ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                      cursor: 'pointer'
                    }}
                  >
                    <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)', display: 'block', marginBottom: '4px' }}>
                      {item.title}
                    </strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', lineHeight: 1.4, display: 'block' }}>
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>

              {options.duplicateMode === 'update' && (
                <div style={{ background: 'var(--color-surface-muted)', borderRadius: '8px', padding: '14px', border: '1px solid var(--color-border)' }}>
                  <strong style={{ fontSize: '12.5px', display: 'block', marginBottom: '8px' }}>
                    Select fields allowed to update existing contacts:
                  </strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                    {[
                      ['city', 'City / Location'],
                      ['state', 'State'],
                      ['interestedPropertyType', 'Property Interest Type'],
                      ['interestedProject', 'Project / Community'],
                      ['preferredLocation', 'Preferred Location'],
                      ['budgetRange', 'Budget Range'],
                      ['notes', 'Internal Notes']
                    ].map(([f, label]) => {
                      const checked = options.updateFields.includes(f);
                      return (
                        <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...options.updateFields, f]
                                : options.updateFields.filter((x) => x !== f);
                              setOptions((o) => ({ ...o, updateFields: next }));
                            }}
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                  <small style={{ display: 'block', marginTop: '8px', color: 'var(--color-text-muted)', fontSize: '11px' }}>
                    * Verified consent records, opt-out status, historical messages, and ownership are NEVER overwritten.
                  </small>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: PREVIEW & VALIDATION SUMMARY */}
          {step === 4 && summary && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '18px' }}>
                <div style={{ padding: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Total Rows</span>
                  <strong style={{ fontSize: '18px', color: 'var(--color-text-primary)' }}>{summary.total}</strong>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-success-soft)', border: '1px solid var(--color-success-border)', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-success)', display: 'block' }}>Valid Rows</span>
                  <strong style={{ fontSize: '18px', color: 'var(--color-success)' }}>{summary.valid}</strong>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-danger-soft)', border: '1px solid var(--color-danger-border)', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-danger)', display: 'block' }}>Invalid Rows</span>
                  <strong style={{ fontSize: '18px', color: 'var(--color-danger)' }}>{summary.invalid}</strong>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-warning-soft)', border: '1px solid var(--color-warning-border)', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-warning)', display: 'block' }}>File Duplicates</span>
                  <strong style={{ fontSize: '18px', color: 'var(--color-warning)' }}>{summary.duplicatesInFile}</strong>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Already in CRM</span>
                  <strong style={{ fontSize: '18px', color: 'var(--color-text-primary)' }}>{summary.alreadyExists}</strong>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary-border)', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-primary)', display: 'block' }}>Will Import</span>
                  <strong style={{ fontSize: '18px', color: 'var(--color-primary)' }}>{summary.newContacts}</strong>
                </div>
              </div>

              {/* Sample preview table */}
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', maxHeight: '240px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>#</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Full Name</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>WhatsApp Phone</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>City</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Property Interest</th>
                      <th style={{ padding: '6px 10px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview?.rows || []).slice(0, 10).map((r) => (
                      <tr key={r.sourceRowNumber} style={{ borderBottom: '1px solid var(--color-border-subtle)', background: r.status !== 'valid' ? 'var(--color-danger-soft)' : undefined }}>
                        <td style={{ padding: '6px 10px' }}>{r.sourceRowNumber}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.normalized?.fullName || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{r.normalized?.phoneNumber || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{r.normalized?.city || r.normalized?.location || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{r.normalized?.interestedPropertyType || r.normalized?.interestedService || '—'}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: r.status === 'valid' ? 'var(--color-success-soft)' : 'var(--color-danger-soft)', color: r.status === 'valid' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 5: RESULTS */}
          {step === 5 && job && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--color-success-soft)', color: 'var(--color-success)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: 'var(--color-text-primary)' }}>
                Import {job.status}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px' }}>
                Batch <b>{job.batchName}</b> processed from <i>{job.originalFilename}</i>.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', maxWidth: '560px', margin: '0 auto 24px' }}>
                <div style={{ padding: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Created</span>
                  <strong style={{ fontSize: '20px', color: 'var(--color-primary)', display: 'block' }}>{job.createdCount}</strong>
                </div>
                <div style={{ padding: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Updated</span>
                  <strong style={{ fontSize: '20px', color: 'var(--color-info)', display: 'block' }}>{job.updatedCount}</strong>
                </div>
                <div style={{ padding: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Skipped</span>
                  <strong style={{ fontSize: '20px', color: 'var(--color-warning)', display: 'block' }}>{job.skippedCount}</strong>
                </div>
                <div style={{ padding: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Failed</span>
                  <strong style={{ fontSize: '20px', color: 'var(--color-danger)', display: 'block' }}>{job.failedCount}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    onClose();
                  }}
                >
                  <Users size={14} /> View Imported Contacts
                </button>
                {job.failedCount > 0 && (
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => downloadImportErrors(job._id, job.batchName)}
                  >
                    <Download size={14} /> Download Error CSV
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Wizard Footer Navigation */}
        <footer className="contact-modal-foot">
          <div>
            {step > 1 && step < 5 && (
              <button
                type="button"
                className="outline-btn small"
                disabled={busy}
                onClick={() => setStep((s) => s - 1)}
              >
                <ArrowLeft size={13} /> Back
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="outline-btn small" disabled={busy} onClick={onClose}>
              {step === 5 ? 'Close' : 'Cancel'}
            </button>

            {step === 1 && (
              <button
                type="button"
                className="primary-btn small"
                disabled={!file || busy}
                onClick={doUpload}
              >
                {busy ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />} Upload and Continue
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                className="primary-btn small"
                disabled={busy || !mappedValues.includes('fullName') || !mappedValues.includes('phoneNumber')}
                onClick={handleProceedToDuplicates}
              >
                Continue to Duplicates <ArrowRight size={13} />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                className="primary-btn small"
                disabled={busy}
                onClick={handleValidateAndPreview}
              >
                {busy ? <LoaderCircle size={14} className="spin" /> : null} Run Validation & Preview <ArrowRight size={13} />
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                className="primary-btn small"
                disabled={busy || (summary?.newContacts === 0 && options.duplicateMode !== 'update')}
                onClick={doExecute}
              >
                {busy ? <LoaderCircle size={14} className="spin" /> : <CheckCircle2 size={14} />} Confirm and Import Contacts
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
