import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CloudUpload,
  Download,
  FileSpreadsheet,
  History,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  downloadImportErrors,
  downloadTemplate,
  executeImport,
  getImportStatus,
  getPreview,
  listImports,
  listPresets,
  retryImport,
  saveMapping,
  savePreset,
  uploadImport,
  validateImport
} from '../services/imports';
import '../importPage.css';

const CRM_FIELDS = [
  ['', '— Ignore Column —'],
  ['fullName', 'Full Name *'],
  ['phoneNumber', 'Phone / WhatsApp *'],
  ['alternatePhone', 'Alternate Phone'],
  ['email', 'Email Address'],
  ['city', 'City'],
  ['state', 'State'],
  ['interestedProject', 'Project / Community'],
  ['interestedPropertyType', 'Property Interest Type'],
  ['preferredLocation', 'Preferred Location'],
  ['budgetRange', 'Budget Range'],
  ['companyName', 'Company / Brokerage'],
  ['designation', 'Designation'],
  ['website', 'Website'],
  ['location', 'Full Address / Location'],
  ['industry', 'Industry'],
  ['businessCategory', 'Property Category'],
  ['leadSource', 'Lead Source'],
  ['leadStatus', 'Lead Status'],
  ['priority', 'Priority'],
  ['estimatedDealValue', 'Estimated Deal Value'],
  ['notes', 'Internal Notes'],
  ['tags', 'Tags']
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const getErrorMessage = (e) => e.response?.data?.message || e.message || 'Something went wrong.';
const formatFileSize = (n) =>
  n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

const STEPS = [
  'Upload file',
  'Map columns',
  'Validate',
  'Duplicates',
  'Import',
  'Results'
];

export default function ImportPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [job, setJob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [sheet, setSheet] = useState('');
  const [options, setOptions] = useState({
    defaultCountry: 'IN',
    duplicateMode: 'skip',
    defaultLeadSource: '',
    defaultInterestedService: '',
    batchName: '',
    tagsText: '',
    updateFields: ['city', 'state', 'interestedProject', 'preferredLocation', 'budgetRange', 'notes']
  });
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [presets, setPresets] = useState([]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('new');
  const [presetName, setPresetName] = useState('');

  const refreshHistory = useCallback(async () => {
    try {
      const [{ data: a }, { data: b }] = await Promise.all([listImports(), listPresets()]);
      setHistory(a.jobs || []);
      setPresets(b.presets || []);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const reset = () => {
    setJob(null);
    setPreview(null);
    setMapping({});
    setSummary(null);
    setFile(null);
    setStep(1);
  };

  const handleChooseFile = (f) => {
    if (!f) return;
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
    if (!['.xlsx', '.csv'].includes(ext)) {
      toast.error('Choose an .xlsx or .csv file. Legacy .xls files are not supported.');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error('File must be 10 MB or smaller.');
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
      setTab('new');
      toast.success('File uploaded and inspected.');
      await refreshHistory();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const selectSheet = async (value) => {
    setSheet(value);
    try {
      const { data } = await getPreview(job._id, { sheet: value });
      setPreview(data);
      setMapping(data.suggestedMappings || {});
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const setField = (header, value) => {
    setMapping((m) => ({ ...m, [header]: value }));
  };

  const mappedValues = Object.values(mapping).filter(Boolean);
  const duplicateMapping = useMemo(
    () => mappedValues.filter((x) => !x.startsWith('custom:')).find((x, i) => mappedValues.indexOf(x) !== i),
    [mappedValues]
  );

  const saveAndValidate = async () => {
    if (duplicateMapping) {
      toast.error('Each contact field can be mapped only once.');
      return;
    }
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
      setStep(3);
      await refreshHistory();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const waitForCompletion = async (id) => {
    for (let i = 0; i < 600; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const { data } = await getImportStatus(id);
      setJob(data.job);
      if (['Completed', 'Completed With Errors', 'Failed', 'Cancelled'].includes(data.job.status)) {
        return data.job;
      }
    }
    throw new Error('Import is still running. Check Import history for progress.');
  };

  const doExecute = async () => {
    setBusy(true);
    try {
      await executeImport(job._id);
      const done = await waitForCompletion(job._id);
      setJob(done);
      setStep(6);
      await refreshHistory();
      toast.success('Import finished successfully.');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const viewJob = async (j) => {
    setBusy(true);
    try {
      setJob(j);
      const { data } = await getPreview(j._id);
      setPreview(data);
      setSheet(j.selectedSheet);
      setMapping(j.columnMappings || {});
      setSummary({
        total: j.totalRows,
        valid: j.validatedRows,
        invalid: j.invalidCount,
        duplicatesInFile: j.duplicateFileCount,
        alreadyExists: j.skippedCount,
        newContacts: Math.max(0, j.validatedRows - j.skippedCount)
      });
      setStep(
        j.status === 'Completed' || j.status === 'Completed With Errors' || j.status === 'Failed'
          ? 6
          : j.status === 'Ready for Review'
          ? 3
          : 2
      );
      setTab('new');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const retry = async (j) => {
    setBusy(true);
    try {
      await retryImport(j._id);
      const done = await waitForCompletion(j._id);
      toast.success(`Retry finished: ${done.createdCount} created, ${done.failedCount} failed.`);
      await refreshHistory();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runWithToast = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      await refreshHistory();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const shownRows = preview?.rows || [];
  const previewStatus = (r) =>
    r.status === 'valid'
      ? 'Valid'
      : r.status === 'duplicate_file'
      ? 'Duplicate in file'
      : r.status === 'already_exists'
      ? 'Already exists'
      : r.status === 'invalid_phone'
      ? 'Invalid phone'
      : r.status === 'invalid_email'
      ? 'Invalid email'
      : r.status === 'missing_required'
      ? 'Missing required'
      : 'Needs review';

  return (
    <div className="import-page">
      {/* Page Header */}
      <div className="import-heading">
        <div className="import-heading-text">
          <div className="form-kicker">CONTACTS · SPREADSHEET IMPORT</div>
          <h1>Import contacts</h1>
          <p>Bring your spreadsheet into Relay with a guided, reviewable import and duplicate protection.</p>
        </div>
        <div className="import-heading-actions">
          <button type="button" className="outline-btn" onClick={() => navigate('/contacts')}>
            <ArrowLeft size={14} /> Back to Contacts
          </button>
          <button
            type="button"
            className="outline-btn"
            onClick={() => runWithToast(downloadTemplate, 'Sample Excel template downloaded')}
          >
            <ArrowDownToLine size={15} /> Download sample Excel
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="import-tabs">
        <button
          type="button"
          className={tab === 'new' ? 'active' : ''}
          onClick={() => setTab('new')}
        >
          <Upload size={15} /> New import
        </button>
        <button
          type="button"
          className={tab === 'history' ? 'active' : ''}
          onClick={() => setTab('history')}
        >
          <History size={15} /> Import history <span>{history.length}</span>
        </button>
      </div>

      {tab === 'history' ? (
        /* History Section */
        <section className="import-card history-card">
          <div className="section-title">
            <div>
              <h2>Previous imports</h2>
              <p>Review completed, in-progress, and failed import batches.</p>
            </div>
            <button type="button" className="outline-btn small" onClick={refreshHistory}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {history.length > 0 ? (
            <div className="table-wrap">
              <table className="import-history-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Filename</th>
                    <th>Uploaded</th>
                    <th>Uploaded by</th>
                    <th>Rows</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th>Skipped</th>
                    <th>Failed</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((j) => (
                    <tr key={j._id}>
                      <td><b>{j.batchName}</b></td>
                      <td>{j.originalFilename}</td>
                      <td>{new Date(j.createdAt).toLocaleDateString()}</td>
                      <td>{j.uploadedBy?.name || j.uploadedBy?.email || '—'}</td>
                      <td>{j.totalRows}</td>
                      <td><span style={{ color: '#16A34A', fontWeight: 600 }}>{j.createdCount}</span></td>
                      <td><span style={{ color: '#2563EB', fontWeight: 600 }}>{j.updatedCount}</span></td>
                      <td><span style={{ color: '#D97706', fontWeight: 600 }}>{j.skippedCount}</span></td>
                      <td><span style={{ color: j.failedCount > 0 ? '#DC2626' : 'inherit', fontWeight: j.failedCount > 0 ? 700 : 400 }}>{j.failedCount}</span></td>
                      <td>
                        <span className={`import-status ${j.status === 'Completed' ? 'good' : ''}`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="import-actions">
                        <button type="button" className="text-action" onClick={() => viewJob(j)}>
                          Details
                        </button>
                        {['Completed With Errors', 'Failed'].includes(j.status) && j.failedCount > 0 && (
                          <button type="button" className="text-action" onClick={() => retry(j)}>
                            Retry
                          </button>
                        )}
                        {(j.failedCount > 0 || j.invalidCount > 0 || j.skippedCount > 0) && (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Download error report"
                            title="Download error CSV"
                            onClick={() =>
                              runWithToast(
                                () => downloadImportErrors(j._id, j.batchName),
                                'Error report downloaded'
                              )
                            }
                          >
                            <Download size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="import-empty">
              <History size={32} />
              <strong>No imports yet</strong>
              <span>Completed and in-progress spreadsheet imports will appear here.</span>
              <button type="button" className="primary-btn small" onClick={() => setTab('new')}>
                Start an import
              </button>
            </div>
          )}
        </section>
      ) : (
        /* Stepper & Wizard Section */
        <>
          <div className="import-steps">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`import-step ${
                    step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''
                  }`}
                >
                  <span>{step > i + 1 ? <Check size={14} /> : i + 1}</span>
                  <b>{s}</b>
                </div>
                {i < STEPS.length - 1 && <div className="import-step-divider" />}
              </React.Fragment>
            ))}
          </div>

          {/* STEP 1: Upload File */}
          {step === 1 && (
            <section className="import-card upload-card">
              <div className="section-title">
                <div>
                  <h2>Upload a contact file</h2>
                  <p>One workbook (.xlsx) or CSV file per import. Maximum 10 MB and up to 10,000 data rows.</p>
                </div>
                <FileSpreadsheet size={24} style={{ color: 'var(--color-primary)' }} />
              </div>

              <div
                className={`drop-zone ${drag ? 'dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  handleChooseFile(e.dataTransfer.files?.[0]);
                }}
              >
                <div className="upload-icon">
                  <CloudUpload size={26} />
                </div>
                <strong>Drop your spreadsheet here</strong>
                <span>or choose a file from your device</span>
                <label className="outline-btn">
                  <Upload size={14} /> Browse files
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    hidden
                    onChange={(e) => handleChooseFile(e.target.files?.[0])}
                  />
                </label>
                <small>Supported formats: .xlsx, .csv · Legacy .xls files are not supported</small>
              </div>

              {file && (
                <div className="selected-file">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="file-type">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <strong>{file.name}</strong>
                      <span>{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setFile(null)}
                    aria-label="Remove selected file"
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              <div className="import-note">
                <ShieldCheck size={18} />
                <div>
                  <strong>Consent & Safety Guard:</strong> Importing contacts never grants WhatsApp consent or sends messages automatically. Every contact starts with consent marked <i>Unknown</i> until explicit opt-in is verified.
                </div>
              </div>

              <footer className="wizard-footer">
                <span>Excel formulas, macros, and external links are safely ignored.</span>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!file || busy}
                  onClick={doUpload}
                >
                  {busy ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />}
                  Upload and continue
                </button>
              </footer>
            </section>
          )}

          {/* STEP 2: Choose Worksheet & Map Columns */}
          {step === 2 && job && (
            <section className="import-card">
              <div className="section-title">
                <div>
                  <h2>Choose worksheet & map columns</h2>
                  <p>We’ve suggested matches based on your spreadsheet headings. Review each column before continuing.</p>
                </div>
                <span className="row-count">
                  <Users size={14} /> {preview?.totalRows || 0} rows found
                </span>
              </div>

              {job.sheetNames?.length > 1 && (
                <label className="field" style={{ maxWidth: '320px' }}>
                  Worksheet
                  <select value={sheet} onChange={(e) => selectSheet(e.target.value)}>
                    {job.sheetNames.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="mapping-table">
                <div className="mapping-head">
                  <span>Source spreadsheet column</span>
                  <span>Relay CRM Contact field</span>
                  <span>Match status</span>
                </div>
                {(preview?.headers || []).map((h) => (
                  <div className="mapping-row" key={h}>
                    <span className="mapping-source" title={h}>{h}</span>
                    <select
                      value={mapping[h] || ''}
                      onChange={(e) => setField(h, e.target.value)}
                    >
                      {CRM_FIELDS.map(([v, label]) => (
                        <option key={v + label} value={v}>{label}</option>
                      ))}
                      <option value={`custom:${h}`}>Custom CRM Field: {h}</option>
                    </select>
                    <span className={mapping[h] ? 'mapped-indicator' : 'unmapped-indicator'}>
                      {mapping[h] ? (
                        <>
                          <Check size={13} /> Mapped
                        </>
                      ) : (
                        'Ignored'
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mapping-tip">
                * Both <b>Full Name</b> and <b>Phone / WhatsApp</b> are required to proceed. Unmapped columns will be ignored.
              </p>

              {/* Preset Row */}
              <div className="preset-row">
                <label className="field" style={{ flex: 1, minWidth: '200px' }}>
                  Save mapping preset
                  <input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g. Luxury Portal Leads"
                  />
                </label>
                <button
                  type="button"
                  className="outline-btn"
                  disabled={!presetName.trim()}
                  onClick={() =>
                    runWithToast(async () => {
                      const { data } = await savePreset({
                        name: presetName,
                        mappings: mapping,
                        defaultCountry: options.defaultCountry
                      });
                      setPresets((p) => [...p.filter((x) => x._id !== data.preset._id), data.preset]);
                      setPresetName('');
                    }, 'Mapping preset saved')
                  }
                >
                  Save preset
                </button>
                {presets.length > 0 && (
                  <label className="field" style={{ flex: 1, minWidth: '200px' }}>
                    Load saved preset
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const p = presets.find((x) => x._id === e.target.value);
                        if (p) {
                          setMapping(p.mappings);
                          setOptions((o) => ({ ...o, defaultCountry: p.defaultCountry || 'IN' }));
                          toast.success(`Preset "${p.name}" applied.`);
                        }
                      }}
                    >
                      <option value="">Choose a saved preset...</option>
                      {presets.map((p) => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {/* Configuration Grid */}
              <div className="import-config-grid">
                <label className="field">
                  Default Country / Dial Code
                  <select
                    value={options.defaultCountry}
                    onChange={(e) => setOptions((o) => ({ ...o, defaultCountry: e.target.value }))}
                  >
                    {[
                      ['IN', 'India (+91)'],
                      ['AE', 'United Arab Emirates (+971)'],
                      ['US', 'United States (+1)'],
                      ['GB', 'United Kingdom (+44)'],
                      ['CA', 'Canada (+1)'],
                      ['AU', 'Australia (+61)'],
                      ['SG', 'Singapore (+65)'],
                      ['SA', 'Saudi Arabia (+966)'],
                      ['QA', 'Qatar (+974)'],
                      ['KW', 'Kuwait (+965)']
                    ].map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Default Lead Source
                  <input
                    value={options.defaultLeadSource}
                    onChange={(e) => setOptions((o) => ({ ...o, defaultLeadSource: e.target.value }))}
                    placeholder="e.g. Exhibition, Portal, Ads"
                  />
                </label>
                <label className="field">
                  Default Interested Property / Project
                  <input
                    value={options.defaultInterestedService}
                    onChange={(e) => setOptions((o) => ({ ...o, defaultInterestedService: e.target.value }))}
                    placeholder="e.g. Palm Villas, Downtown"
                  />
                </label>
                <label className="field">
                  Import Batch Name
                  <input
                    maxLength="120"
                    value={options.batchName}
                    onChange={(e) => setOptions((o) => ({ ...o, batchName: e.target.value }))}
                  />
                </label>
                <label className="field">
                  Default Tags <span className="field-hint">(comma separated)</span>
                  <input
                    value={options.tagsText}
                    onChange={(e) => setOptions((o) => ({ ...o, tagsText: e.target.value }))}
                    placeholder="e.g. hnw-buyer, palm-jumeirah"
                  />
                </label>
              </div>

              <div className="import-note">
                <ShieldCheck size={18} />
                <div>
                  Imported contact consent is strictly set to <b>Unknown</b>. A "Yes" value in your spreadsheet will not grant WhatsApp marketing consent without verified opt-in evidence.
                </div>
              </div>

              <footer className="wizard-footer">
                <button type="button" className="outline-btn" onClick={reset}>
                  <ArrowLeft size={14} /> Choose another file
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={busy}
                  onClick={saveAndValidate}
                >
                  {busy ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />}
                  Validate and preview
                </button>
              </footer>
            </section>
          )}

          {/* STEP 3, 4, 5: Preview, Duplicates & Confirmation */}
          {(step === 3 || step === 4 || step === 5) && summary && (
            <section className="import-card">
              <div className="section-title">
                <div>
                  <h2>
                    {step === 3
                      ? 'Preview & Validation Results'
                      : step === 4
                      ? 'Choose Duplicate Handling Policy'
                      : 'Review & Confirm Import'}
                  </h2>
                  <p>
                    {step === 3
                      ? 'Review the parsed rows, normalized phones, and detected duplicates before continuing.'
                      : step === 4
                      ? 'Decide how to handle contacts that already exist in your CRM database.'
                      : 'Final check of contact numbers and policies before writing to your database.'}
                  </p>
                </div>
              </div>

              {/* KPI Summary Grid */}
              <div className="summary-grid">
                <Summary label="Total rows" value={summary.total} />
                <Summary label="Valid rows" value={summary.valid} color="#16A34A" />
                <Summary label="Invalid rows" value={summary.invalid} color={summary.invalid > 0 ? '#DC2626' : undefined} />
                <Summary label="Duplicates in file" value={summary.duplicatesInFile} color={summary.duplicatesInFile > 0 ? '#D97706' : undefined} />
                <Summary label="Existing contacts" value={summary.alreadyExists} />
                <Summary label="New contacts" value={summary.newContacts} color="var(--color-primary)" />
              </div>

              {/* Preview Table */}
              <div className="table-wrap">
                <table className="import-preview-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Full Name</th>
                      <th>Phone / WhatsApp</th>
                      <th>Project / Property</th>
                      <th>City</th>
                      <th>Email</th>
                      <th>Validation Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.map((r) => {
                      const raw = r.raw || {};
                      const getRaw = (names) =>
                        Object.entries(raw).find(([k]) =>
                          names.includes(k.toLowerCase().replace(/[^a-z0-9]/g, ''))
                        )?.[1] || '—';

                      return (
                        <tr
                          key={r.sourceRowNumber}
                          className={r.status === 'valid' ? '' : 'problem-row'}
                        >
                          <td><b>#{r.sourceRowNumber}</b></td>
                          <td>{r.normalized?.fullName || getRaw(['name', 'fullname', 'customername', 'clientname'])}</td>
                          <td>
                            <code>{r.normalized?.phoneNumber || getRaw(['phone', 'phonenumber', 'mobile', 'whatsapp'])}</code>
                          </td>
                          <td>{r.normalized?.interestedProject || r.normalized?.interestedService || getRaw(['project', 'property', 'interestedproject', 'service'])}</td>
                          <td>{r.normalized?.city || getRaw(['city', 'location'])}</td>
                          <td>{r.normalized?.email || getRaw(['email', 'emailid', 'emailaddress'])}</td>
                          <td>
                            <span className={`validation-pill ${r.status === 'valid' ? 'good' : ''}`}>
                              {previewStatus(r)}
                            </span>
                            {r.errors?.length > 0 && (
                              <small className="validation-detail">
                                {r.errors.map((x) => x.message).join(' · ')}
                              </small>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Duplicate Handling Section (Step 4 & 5) */}
              <div className="import-settings">
                <label className="field" style={{ maxWidth: '320px' }}>
                  Duplicate handling policy
                  <select
                    value={options.duplicateMode}
                    onChange={(e) => setOptions((o) => ({ ...o, duplicateMode: e.target.value }))}
                  >
                    <option value="skip">Skip duplicates (Safe default — preserves existing contacts)</option>
                    <option value="update">Update existing contacts with spreadsheet data</option>
                    <option value="new">Import only new contacts (Ignore matching phones)</option>
                  </select>
                </label>

                {options.duplicateMode === 'update' && (
                  <div className="update-fields">
                    <b>Select fields allowed to update existing contacts:</b>
                    <p>
                      Blank cells are never overwritten. WhatsApp consent status, messaging history, internal notes, and ownership are strictly preserved.
                    </p>
                    <div className="update-fields-grid">
                      {[
                        ['interestedProject', 'Project / Community'],
                        ['interestedPropertyType', 'Property Type'],
                        ['budgetRange', 'Budget Range'],
                        ['city', 'City'],
                        ['state', 'State'],
                        ['preferredLocation', 'Preferred Location'],
                        ['email', 'Email Address'],
                        ['companyName', 'Company'],
                        ['leadSource', 'Lead Source'],
                        ['leadStatus', 'Lead Status']
                      ].map(([f, label]) => (
                        <label key={f}>
                          <input
                            type="checkbox"
                            checked={options.updateFields.includes(f)}
                            onChange={(e) =>
                              setOptions((o) => ({
                                ...o,
                                updateFields: e.target.checked
                                  ? [...o.updateFields, f]
                                  : o.updateFields.filter((x) => x !== f)
                              }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="import-note">
                <ShieldCheck size={18} />
                <div>
                  Existing customer consent records, opt-outs, and conversation timelines are strictly preserved and cannot be overwritten by spreadsheet imports.
                </div>
              </div>

              <footer className="wizard-footer">
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => (step === 3 ? setStep(2) : step === 4 ? setStep(3) : setStep(4))}
                >
                  <ArrowLeft size={14} /> Back
                </button>

                {step === 3 && (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => setStep(4)}
                  >
                    Configure duplicates <ArrowRight size={14} />
                  </button>
                )}

                {step === 4 && (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      if (options.duplicateMode === 'update' && !options.updateFields.length) {
                        toast.error('Select at least one update field.');
                        return;
                      }
                      setStep(5);
                    }}
                  >
                    Review import <ArrowRight size={14} />
                  </button>
                )}

                {step === 5 && (
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busy || summary.valid === 0}
                    onClick={doExecute}
                  >
                    {busy ? <LoaderCircle className="spin" size={15} /> : <CheckCircle2 size={15} />}
                    Import {summary.newContacts} new contacts
                  </button>
                )}
              </footer>
            </section>
          )}

          {/* STEP 6: Import Results */}
          {step === 6 && job && (
            <section className="import-card result-card">
              <div className={`result-icon ${job.status === 'Completed' ? 'success' : ''}`}>
                {job.status === 'Completed' ? <CheckCircle2 size={36} /> : <AlertCircle size={36} />}
              </div>
              <div className="form-kicker">IMPORT {job.status?.toUpperCase()}</div>
              <h2>{job.status === 'Completed' ? 'Your contacts are ready!' : 'Import Results'}</h2>
              <p>
                Processed batch <b>{job.batchName}</b> from <i>{job.originalFilename}</i>.
              </p>

              <div className="summary-grid">
                <Summary label="Total rows" value={job.totalRows} />
                <Summary label="Created" value={job.createdCount} color="#16A34A" />
                <Summary label="Updated" value={job.updatedCount} color="#2563EB" />
                <Summary label="Skipped" value={job.skippedCount} color="#D97706" />
                <Summary label="Invalid" value={job.invalidCount} color={job.invalidCount > 0 ? '#DC2626' : undefined} />
                <Summary label="Failed writes" value={job.failedCount} color={job.failedCount > 0 ? '#DC2626' : undefined} />
              </div>

              <div className="progress-track">
                <span style={{ width: `${job.progress || 100}%` }} />
              </div>

              <div className="result-actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => navigate('/contacts')}
                >
                  <Users size={15} /> View Contacts
                </button>
                {(job.failedCount > 0 || job.invalidCount > 0 || job.skippedCount > 0) && (
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() =>
                      runWithToast(
                        () => downloadImportErrors(job._id, job.batchName),
                        'Error report downloaded'
                      )
                    }
                  >
                    <Download size={15} /> Download Error CSV
                  </button>
                )}
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => {
                    reset();
                    setTab('new');
                  }}
                >
                  <Upload size={15} /> Start another import
                </button>
              </div>
            </section>
          )}

          {/* Recent Imports Teaser (Step 1) */}
          {!job && history.length > 0 && (
            <section className="history-teaser">
              <div className="history-teaser-head">
                <strong>Recent spreadsheet imports</strong>
                <button type="button" className="text-action" onClick={() => setTab('history')}>
                  View import history <ArrowRight size={13} />
                </button>
              </div>
              {history.slice(0, 3).map((j) => (
                <button
                  type="button"
                  className="recent-job"
                  key={j._id}
                  onClick={() => viewJob(j)}
                >
                  <span>
                    <FileSpreadsheet size={16} style={{ color: 'var(--color-primary)' }} />
                    <b>{j.batchName}</b>
                  </span>
                  <span>
                    {j.status} · <b>{j.createdCount}</b> created
                  </span>
                </button>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Summary({ label, value, color }) {
  return (
    <div className="summary-tile">
      <span>{label}</span>
      <strong style={color ? { color } : undefined}>{value ?? 0}</strong>
    </div>
  );
}
