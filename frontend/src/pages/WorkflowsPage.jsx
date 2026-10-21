import {useCallback,useEffect,useMemo,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {addEdge,Background,Controls,Handle,MiniMap,Position,ReactFlow,ReactFlowProvider,useEdgesState,useNodesState,useReactFlow} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {Activity,AlertTriangle,ArrowLeft,ArrowRight,CalendarClock,Check,ChevronDown,Clock3,Copy,GitBranch,LoaderCircle,Play,Plus,Save,Search,ShieldCheck,Sparkles,Trash2,Workflow as WorkflowIcon,X,Zap} from 'lucide-react';
import toast from 'react-hot-toast';
import {listContacts} from '../services/contacts';
import {listTemplates,getTemplateVersions} from '../services/templates';
import * as api from '../services/workflows';

const TYPES={manualTrigger:['Trigger','Manual Trigger'],scheduledTrigger:['Trigger','Scheduled Trigger'],contactCreated:['Trigger','Contact Created'],leadStatusChanged:['Trigger','Lead Status Changed'],importCompleted:['Trigger','Import Completed'],ifElse:['Logic','IF / ELSE'],hasReplied:['Logic','Has Replied'],wait:['Delay','Wait'],validateContact:['Action','Validate Contact'],checkConsent:['Action','Check Consent'],messageSimulation:['Action','Simulate WhatsApp Message'],updateLeadStatus:['Action','Update Lead Status'],addContactTag:['Action','Add Contact Tag'],createFollowupTask:['Action','Create Follow-up Task'],addInternalNote:['Action','Add CRM Note'],stop:['Control','Stop Workflow'],end:['Control','End Workflow']};
const DEFAULTS={manualTrigger:{},scheduledTrigger:{},contactCreated:{},leadStatusChanged:{},importCompleted:{},ifElse:{condition:{field:'leadStatus',operator:'eq',value:'Interested'}},hasReplied:{},wait:{duration:2,unit:'days',timezone:'Asia/Kolkata'},validateContact:{},checkConsent:{purpose:''},messageSimulation:{templateId:'',templateVersionId:'',purpose:''},updateLeadStatus:{status:'Follow-up Required'},addContactTag:{tag:'follow-up'},createFollowupTask:{title:'Review this lead'},addInternalNote:{note:''},stop:{},end:{}};
const OPERATORS={Equal:'eq', 'Not equal':'ne',Contains:'contains','Does not contain':'notContains','Greater than':'gt','Less than':'lt','Is empty':'empty','Is not empty':'notEmpty','Is true':'true','Is false':'false','In list':'in','Not in list':'notIn'};
const STATUSES=['New','Contacted','Interested','Follow-up Required','Negotiation','Converted','Not Interested','Closed'];
const err=e=>e.response?.data?.message||e.message||'Something went wrong.';
const newNode=(type,x=360,y=180)=>({id:`${type}-${Math.random().toString(36).slice(2,8)}`,type:'workflowNode',position:{x,y},data:{nodeType:type,label:TYPES[type]?.[1]||type,config:{...DEFAULTS[type]}}});
const fromApi=(v=[])=>v.map(n=>({id:n.id,type:'workflowNode',position:n.position||{x:0,y:0},data:{nodeType:n.type,label:n.label||TYPES[n.type]?.[1]||n.type,config:n.config||{}}}));
const toApi=(nodes,edges)=>({nodes:nodes.map(n=>({id:n.id,type:n.data.nodeType,position:n.position,label:n.data.label,config:n.data.config||{}})),edges:edges.map(e=>({id:e.id,source:e.source,target:e.target,sourceHandle:e.sourceHandle||null,targetHandle:e.targetHandle||null}))});
function Badge({value}){return <span className={`wf-badge wf-${String(value||'Draft').toLowerCase()}`}>{value||'Draft'}</span>}
function WorkflowNodeView({data,selected}){const type=data.nodeType||'unknown',kind=TYPES[type]?.[0]||'Node';const trigger=kind==='Trigger',end=['end','stop'].includes(type),branch=['ifElse','hasReplied'].includes(type);return <div className={`wf-node wf-node-${kind.toLowerCase()} ${selected?'selected':''}`}><div className="wf-node-top"><span className="wf-node-icon">{kind==='Trigger'?<Zap size={14}/>:kind==='Logic'?<GitBranch size={14}/>:kind==='Delay'?<Clock3 size={14}/>:kind==='Control'?<X size={14}/>:<Activity size={14}/>}</span><div><small>{kind}</small><b>{data.label}</b></div></div>{type==='messageSimulation'&&<small className="wf-mock-label">MOCK ONLY</small>}{type==='wait'&&<small>{data.config?.duration||2} {data.config?.unit||'days'}</small>}{!trigger&&<Handle type="target" position={Position.Top}/ >}{!end&&branch?<><Handle type="source" id="true" position={Position.Bottom} style={{left:'25%'}}/><Handle type="source" id="false" position={Position.Bottom} style={{left:'75%'}}/><small className="wf-branch-labels"><i>True</i><i>False</i></small></>:!end&&<Handle type="source" position={Position.Bottom}/>}</div>}
const nodeTypes={workflowNode:WorkflowNodeView};
function NodeConfig({node,onChange,templates,versions,onTemplate,loadVersions}){if(!node)return <div className="wf-config-empty"><WorkflowIcon size={24}/><b>Select a node</b><span>Node settings appear here.</span></div>;const type=node.data.nodeType,c=node.data.config||{};const set=(k,v)=>onChange({...c,[k]:v});const rule=c.condition||{};const setRule=(k,v)=>set('condition',{...rule,[k]:v});return <div className="wf-config"><div className="wf-config-title"><div><small>{TYPES[type]?.[0]}</small><h3>{node.data.label}</h3></div><Badge value="Config"/></div>{['manualTrigger','contactCreated','leadStatusChanged','importCompleted','end','stop','validateContact'].includes(type)&&<p className="wf-muted">{type==='manualTrigger'?'Starts when you run a workflow test or an explicitly requested mock run.':type==='end'||type==='stop'?'This node ends this contact’s workflow path.':'This event trigger is not connected to an external event source yet; use it in test mode only.'}</p>}
 {type==='wait'&&<><label className="wf-field">Duration<input type="number" min="1" max="30" value={c.duration||1} onChange={e=>set('duration',Number(e.target.value))}/></label><label className="wf-field">Unit<select value={c.unit||'days'} onChange={e=>set('unit',e.target.value)}>{['minutes','hours','days'].map(x=><option key={x}>{x}</option>)}</select></label><label className="wf-field">Timezone<input value={c.timezone||'Asia/Kolkata'} onChange={e=>set('timezone',e.target.value)} placeholder="Asia/Kolkata"/></label><p className="wf-muted">Waits are stored in MongoDB and continue after the API restarts. When the workflow is paused, continuation is held.</p></>}
 {['ifElse'].includes(type)&&<><label className="wf-field">Contact field<select value={rule.field||'leadStatus'} onChange={e=>setRule('field',e.target.value)}>{['fullName','companyName','businessCategory','businessSubcategory','industry','interestedService','location','leadSource','leadStatus','priority','whatsappConsentStatus','isArchived'].map(f=><option key={f}>{f}</option>)}</select></label><label className="wf-field">Operator<select value={rule.operator||'eq'} onChange={e=>setRule('operator',e.target.value)}>{Object.entries(OPERATORS).map(([label,value])=><option key={value} value={value}>{label}</option>)}</select></label>{!['empty','notEmpty','true','false'].includes(rule.operator)&&<label className="wf-field">Expected value<input value={Array.isArray(rule.value)?rule.value.join(', '):rule.value||''} onChange={e=>setRule('value',['in','notIn'].includes(rule.operator)?e.target.value.split(',').map(x=>x.trim()):e.target.value)}/></label>}<p className="wf-muted">Missing values resolve to Unknown. Connect True and False branches; Unknown stops with an explicit log.</p></>}
 {type==='hasReplied'&&<p className="wf-muted">Reply state is UNKNOWN until genuine reply data is connected. Only test mode can inject a synthetic reply event.</p>}
 {type==='checkConsent'&&<label className="wf-field">Intended purpose<input value={c.purpose||''} onChange={e=>set('purpose',e.target.value)} placeholder="Website Development"/></label>}
 {type==='messageSimulation'&&<><label className="wf-field">Saved message template<select value={c.templateId||''} onChange={e=>{set('templateId',e.target.value);set('templateVersionId','');loadVersions(e.target.value)}}><option value="">Choose template</option>{templates.map(t=><option key={t._id} value={t._id}>{t.name} · {t.language} · {t.providerStatus}</option>)}</select></label><label className="wf-field">Pinned version<select value={c.templateVersionId||''} onChange={e=>set('templateVersionId',e.target.value)}><option value="">Choose version</option>{versions.map(v=><option key={v._id} value={v._id}>v{v.versionNumber} · {v.snapshot.localStatus}</option>)}</select></label><label className="wf-field">Consent purpose<input value={c.purpose||''} onChange={e=>set('purpose',e.target.value)} placeholder="Must match recorded opt-in"/></label><div className="wf-mock-warning"><ShieldCheck size={15}/> MOCK ONLY. Requires current evidence-backed consent. No WhatsApp request is made.</div></>}
 {type==='updateLeadStatus'&&<><label className="wf-field">Target lead status<select value={c.status||''} onChange={e=>set('status',e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></label><div className="wf-mock-warning">Real contact changes require an Active workflow and explicit Internal execution mode. Test mode never writes CRM data.</div></>}
 {type==='addContactTag'&&<><label className="wf-field">Tag<input value={c.tag||''} maxLength={40} onChange={e=>set('tag',e.target.value)}/></label><div className="wf-mock-warning">Real contact changes require explicit Internal execution mode.</div></>}
 {type==='createFollowupTask'&&<label className="wf-field">Task title<input value={c.title||''} maxLength={120} onChange={e=>set('title',e.target.value)}/></label>}
 {type==='addInternalNote'&&<label className="wf-field">Note<textarea maxLength={500} value={c.note||''} onChange={e=>set('note',e.target.value)}/></label>}
 </div>}

function WorkflowsPage(){
  const nav=useNavigate();
  const[records,setRecords]=useState([]),[stats,setStats]=useState(null),[templates,setTemplates]=useState([]),[loading,setLoading]=useState(true),[search,setSearch]=useState(''),[status,setStatus]=useState('');
  
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [{data},{data:s},{data:t}]=await Promise.all([
        api.listWorkflows({limit:50,search,status}),
        api.workflowStats(),
        api.workflowTemplates()
      ]);
      setRecords(data.records||[]);
      setStats(s.stats);
      setTemplates(t.records||[]);
    }catch(e){
      toast.error(err(e),{id:'wf-load-error'});
    }finally{
      setLoading(false);
    }
  },[search,status]);

  useEffect(()=>{load();},[load]);

  const make=async(templateKey)=>{
    try{
      const body=templateKey?{
        name:templates.find(t=>t.key===templateKey)?.name||'New workflow',
        templateKey
      }:{
        name:'New workflow',
        nodes:[
          {id:'trigger',type:'manualTrigger',position:{x:240,y:80},label:'Manual Trigger',config:{}},
          {id:'end',type:'end',position:{x:240,y:240},label:'End Workflow',config:{}}
        ],
        edges:[{source:'trigger',target:'end'}]
      };
      const {data}=await api.createWorkflow(body);
      nav(`/workflows/${data.workflow._id}`);
    }catch(e){
      toast.error(err(e));
    }
  };

  const duplicate=async id=>{
    try{
      const{data}=await api.duplicateWorkflow(id);
      nav(`/workflows/${data.workflow._id}`);
    }catch(e){
      toast.error(err(e));
    }
  };

  const archive=async id=>{
    if(!window.confirm('Archive this workflow? Existing run history will be kept.'))return;
    try{
      await api.archiveWorkflow(id);
      toast.success('Workflow archived.');
      load();
    }catch(e){
      toast.error(err(e));
    }
  };

  return (
    <div className="wf-page">
      {/* Page Header */}
      <div className="campaign-heading">
        <div>
          <div className="form-kicker">AUTOMATION STUDIO</div>
          <h1>Automation workflows</h1>
          <p>Build versioned CRM automations and test them safely in mock mode.</p>
        </div>
        <div className="campaign-heading-actions">
          <button className="primary-btn small" onClick={()=>make()}>
            <Plus size={15}/> New workflow
          </button>
        </div>
      </div>

      {/* Workflow Stats */}
      <div className="campaign-stat-grid wf-stat-grid">
        {[
          ['Total workflows',stats?.totalWorkflows],
          ['Active',stats?.activeWorkflows],
          ['Draft',stats?.draftWorkflows],
          ['Paused',stats?.pausedWorkflows],
          ['Runs today',stats?.executionsToday],
          ['Failed today',stats?.failedExecutions]
        ].map(([l,v])=>(
          <div className="campaign-stat-card" key={l}>
            <span>{l}</span>
            <b>{v??'—'}</b>
          </div>
        ))}
      </div>

      {/* Primary Section: Workflow List (Full Width, non-overflowing) */}
      <section className="campaign-panel wf-list-panel">
        <div className="campaign-toolbar">
          <label className="template-search">
            <Search size={14}/>
            <input placeholder="Search workflows..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </label>
          <select value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['Draft','Validated','Published','Active','Paused','Archived'].map(s=>(
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="campaign-table-wrap">
          <table className="campaign-table wf-table">
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Last run</th>
                <th>Next run</th>
                <th>Executions</th>
                <th>Created</th>
                <th style={{textAlign:'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:4},(_,i)=>(
                  <tr className="campaign-skeleton-row" key={i}>
                    <td colSpan="8"><i/></td>
                  </tr>
                ))
              ) : records.length===0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="campaign-empty">
                      <div><WorkflowIcon size={24}/></div>
                      <b>Your automation workspace is ready.</b>
                      <span>Create a workflow from scratch or start with one of the starter templates below.</span>
                      <button className="outline-btn small" onClick={()=>document.getElementById('wf-starters')?.scrollIntoView({behavior:'smooth'})}>
                        Browse starter templates <ArrowRight size={13}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map(w=>(
                  <tr key={w._id}>
                    <td>
                      <Link className="campaign-name-link" to={`/workflows/${w._id}`}>
                        <b>{w.name}</b>
                        <small>{w.description||'No description provided'}</small>
                      </Link>
                    </td>
                    <td><span className="wf-trigger-badge">{w.triggerSummary||'Manual Trigger'}</span></td>
                    <td><Badge value={w.status}/></td>
                    <td>{w.lastRun?new Date(w.lastRun).toLocaleString():'—'}</td>
                    <td>{w.nextRun?new Date(w.nextRun).toLocaleString():'—'}</td>
                    <td><b>{w.executionCount}</b></td>
                    <td>{new Date(w.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="campaign-row-actions" style={{justifyContent:'flex-end'}}>
                        <button title="Open visual editor" onClick={()=>nav(`/workflows/${w._id}`)}>
                          <WorkflowIcon size={14}/>
                        </button>
                        <button title="Duplicate workflow" onClick={()=>duplicate(w._id)}>
                          <Copy size={14}/>
                        </button>
                        {w.status==='Active' ? (
                          <button title="Pause execution" onClick={async()=>{try{await api.pauseWorkflow(w._id);load()}catch(e){toast.error(err(e))}}}>
                            <Clock3 size={14}/>
                          </button>
                        ) : (
                          <button title="Archive workflow" onClick={()=>archive(w._id)}>
                            <Trash2 size={14}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Secondary Section: Workflow Starter Templates (Full Width responsive card grid) */}
      <section className="campaign-panel wf-starters" id="wf-starters">
        <div className="wf-starters-head">
          <div>
            <h2>Workflow template library</h2>
            <p>Ready-to-use automation structures. External messaging actions stay mock-only until provider setup.</p>
          </div>
        </div>
        <div className="wf-template-grid">
          {templates.map(t=>(
            <article key={t.key} className="wf-starter-card">
              <div className="wf-starter-card-top">
                <span className="wf-starter-icon"><Sparkles size={15}/></span>
                <small>{t.requiredFields.length?`${t.requiredFields.length} fields to configure`:'Quick Starter'}</small>
              </div>
              <h3 className="wf-starter-title">{t.name}</h3>
              <p className="wf-starter-desc">{t.description}</p>
              <div className="wf-mini-flow">
                {t.diagram.map((d,i)=>(
                  <span key={i} className="wf-flow-step">{d}</span>
                ))}
              </div>
              <button className="outline-btn small wf-use-btn" onClick={()=>make(t.key)}>
                Use template <ArrowRight size={13}/>
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Bottom Section: Automation Settings with clearly separated labels & inputs */}
      <WorkflowSettingsPanel/>
    </div>
  );
}

function WorkflowSettingsPanel(){
  const[settings,setSettings]=useState(null),[saving,setSaving]=useState(false);
  useEffect(()=>{
    api.workflowSettings().then(({data})=>setSettings(data.settings)).catch(e=>toast.error(err(e)));
  },[]);

  const save=async()=>{
    setSaving(true);
    try{
      const payload=Object.fromEntries(
        ['timezone','maxConcurrency','maxRetries','maxRunsPerWorkflow','maxStepsPerExecution','maxFollowUpSteps','quietHours','overlapPolicy','mockDelayMs','retentionDays'].map(key=>[key,settings[key]])
      );
      const{data}=await api.updateWorkflowSettings(payload);
      setSettings(data.settings);
      toast.success('Automation settings saved.');
    }catch(e){
      toast.error(err(e));
    }finally{
      setSaving(false);
    }
  };

  if(!settings) {
    return <section className="campaign-panel wf-settings-panel"><div className="wf-loading-box">Loading automation worker settings…</div></section>;
  }

  const set=(key,value)=>setSettings(s=>({...s,[key]:value}));

  return (
    <section className="campaign-panel wf-settings-panel">
      <header className="wf-settings-head">
        <div>
          <h2>Automation execution settings</h2>
          <p>Bounded execution constraints and default worker rules enforced by the backend</p>
        </div>
        <button className="primary-btn small" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </header>

      <div className="wf-settings-grid">
        <div className="wf-setting-field">
          <label>Default timezone</label>
          <input
            value={settings.timezone||'Asia/Kolkata'}
            onChange={e=>set('timezone',e.target.value)}
            placeholder="e.g. Asia/Kolkata"
          />
          <small>Applied to scheduled workflow executions</small>
        </div>

        <div className="wf-setting-field">
          <label>Concurrency limit (1–10)</label>
          <input
            type="number"
            min="1"
            max="10"
            value={settings.maxConcurrency}
            onChange={e=>set('maxConcurrency',Number(e.target.value))}
          />
          <small>Simultaneous execution threads per workspace</small>
        </div>

        <div className="wf-setting-field">
          <label>Max retries (0–5)</label>
          <input
            type="number"
            min="0"
            max="5"
            value={settings.maxRetries}
            onChange={e=>set('maxRetries',Number(e.target.value))}
          />
          <small>Automatic retry attempts on temporary step failures</small>
        </div>

        <div className="wf-setting-field">
          <label>Workflow run cap</label>
          <input
            type="number"
            min="1"
            max="10000"
            value={settings.maxRunsPerWorkflow}
            onChange={e=>set('maxRunsPerWorkflow',Number(e.target.value))}
          />
          <small>Total executions allowed per workflow definition</small>
        </div>

        <div className="wf-setting-field">
          <label>Max steps per run (1–100)</label>
          <input
            type="number"
            min="1"
            max="100"
            value={settings.maxStepsPerExecution}
            onChange={e=>set('maxStepsPerExecution',Number(e.target.value))}
          />
          <small>Loop safety ceiling for complex branching logic</small>
        </div>

        <div className="wf-setting-field">
          <label>Max follow-up steps (1–10)</label>
          <input
            type="number"
            min="1"
            max="10"
            value={settings.maxFollowUpSteps}
            onChange={e=>set('maxFollowUpSteps',Number(e.target.value))}
          />
          <small>Maximum follow-up task creations per execution</small>
        </div>

        <div className="wf-setting-field">
          <label>Quiet hours start</label>
          <input
            type="time"
            value={settings.quietHours?.start||'21:00'}
            onChange={e=>set('quietHours',{...settings.quietHours,start:e.target.value})}
          />
          <small>Mock delays pause during quiet hours</small>
        </div>

        <div className="wf-setting-field">
          <label>Quiet hours end</label>
          <input
            type="time"
            value={settings.quietHours?.end||'09:00'}
            onChange={e=>set('quietHours',{...settings.quietHours,end:e.target.value})}
          />
          <small>Execution resumes at end of quiet window</small>
        </div>
      </div>
    </section>
  );
}

function EditorInner(){const {id}=useParams(),nav=useNavigate(),rf=useReactFlow();const[workflow,setWorkflow]=useState(null),[schedules,setSchedules]=useState([]),[version,setVersion]=useState(null),[nodes,setNodes,onNodesChange]=useNodesState([]),[edges,setEdges,onEdgesChange]=useEdgesState([]),[selected,setSelected]=useState(null),[name,setName]=useState(''),[description,setDescription]=useState(''),[busy,setBusy]=useState(Boolean(id)),[validation,setValidation]=useState(null),[templates,setTemplates]=useState([]),[versions,setVersions]=useState([]),[testContacts,setTestContacts]=useState([]),[selectedContact,setSelectedContact]=useState(''),[syntheticReply,setSyntheticReply]=useState(false),[runs,setRuns]=useState([]),[steps,setSteps]=useState([]),[activeExecution,setActiveExecution]=useState(''),[scheduleModal,setScheduleModal]=useState(false),[scheduleType,setScheduleType]=useState('once'),[scheduleStart,setScheduleStart]=useState(''),[timezone,setTimezone]=useState('Asia/Kolkata'),[scheduleTime,setScheduleTime]=useState('09:00'),[librarySearch,setLibrarySearch]=useState(''),[history,setHistory]=useState([]),[historyIndex,setHistoryIndex]=useState(-1);const selectedNode=nodes.find(n=>n.id===selected);const load=useCallback(async()=>{if(!id)return;setBusy(true);try{const[{data:d},{data:t},{data:c}]=await Promise.all([api.getWorkflow(id),listTemplates({archived:'false'}),listContacts({limit:100})]);setWorkflow(d.workflow);setSchedules(d.schedules||[]);setVersion(d.version);setName(d.workflow.name);setDescription(d.workflow.description||'');setNodes(fromApi(d.version?.nodes));setEdges(d.version?.edges||[]);setRuns(d.executions||[]);setTemplates(t.records||[]);setTestContacts(c.records||[]);}catch(e){toast.error(err(e));nav('/workflows')}finally{setBusy(false)}},[id,nav,setNodes,setEdges]);useEffect(()=>{load()},[load]);useEffect(()=>{if(!id)return;const timer=setInterval(async()=>{try{const[{data:d},{data:r}]=await Promise.all([api.getWorkflow(id),api.listWorkflowRuns(id,{limit:20})]);setWorkflow(d.workflow);setSchedules(d.schedules||[]);setRuns(r.records);}catch{}} ,2500);return()=>clearInterval(timer)},[id]);useEffect(()=>{if(activeExecution){api.executionSteps(activeExecution).then(({data})=>setSteps(data.records)).catch(e=>toast.error(err(e)));}},[activeExecution]);useEffect(()=>{if(!selectedNode)return;const tid=selectedNode.data.config?.templateId;if(tid)getTemplateVersions(tid).then(({data})=>setVersions(data.records||[])).catch(()=>setVersions([]));else setVersions([])},[selectedNode?.id,selectedNode?.data.config?.templateId]);
 const pushHistory=()=>{setHistory(h=>[...h.slice(-19),{nodes,edges}]);setHistoryIndex(i=>Math.min(19,i+1));};const add=(type)=>{pushHistory();const n=newNode(type,rf.getViewport().x*-1+340,rf.getViewport().y*-1+200);setNodes(v=>[...v,n]);setSelected(n.id);};const onConnect=connection=>{pushHistory();setEdges(e=>addEdge({...connection,id:`edge-${Math.random().toString(36).slice(2,8)}`,type:'smoothstep',animated:false},e));};const changeConfig=config=>setNodes(ns=>ns.map(n=>n.id===selected?{...n,data:{...n.data,config}}:n));const save=async()=>{if(name.trim().length<3)return toast.error('Workflow name must have at least 3 characters.');setBusy(true);try{let result;if(id){const{data}=await api.updateWorkflow(id,{name,description,...toApi(nodes,edges)});result=data;setWorkflow(result.workflow);setVersion(result.version||version);}else{const{data}=await api.createWorkflow({name,description,...toApi(nodes,edges)});result=data;nav(`/workflows/${data.workflow._id}`,{replace:true});}toast.success('Workflow draft saved.');return result;}catch(e){toast.error(err(e));return null;}finally{setBusy(false)}};const validate=async()=>{const saved=await save();if(!saved)return;const wid=id||saved.workflow._id;try{const{data}=await api.validateWorkflow(wid);setValidation(data.validation);setWorkflow(data.workflow);setVersion(data.version);toast[data.validation.valid?'success':'error'](data.validation.valid?'Workflow is valid.':'Fix the highlighted validation issues.');}catch(e){setValidation(e.response?.data?.validation||null);toast.error(err(e));}};const publish=async()=>{try{const saved=await save();if(!saved)return;const{data}=await api.publishWorkflow(id||saved.workflow._id);setWorkflow(data.workflow);setVersion(data.version);toast.success(`Published version ${data.version.versionNumber}.`);}catch(e){if(e.response?.data?.validation)setValidation(e.response.data.validation);toast.error(err(e));}};const test=async()=>{try{const saved=await save();if(!saved)return;const wid=id||saved.workflow._id;const{data}=await api.testWorkflow(wid,{contactId:selectedContact||undefined,triggerData:{syntheticReplyEvent:syntheticReply}});setActiveExecution(data.execution._id);toast.success(data.notice);}catch(e){toast.error(err(e));}};const run=async()=>{if(!id)return;try{const{data}=await api.runWorkflow(id,{executionMode:'mock',contactId:selectedContact||undefined});setActiveExecution(data.execution._id);toast.success(data.notice);}catch(e){toast.error(err(e));}};const loadVersions=async tid=>{try{const{data}=await getTemplateVersions(tid);setVersions(data.records||[])}catch(e){setVersions([])}};const duplicateNode=()=>{if(!selectedNode)return;pushHistory();const n={...selectedNode,id:`${selectedNode.data.nodeType}-${Math.random().toString(36).slice(2,7)}`,position:{x:selectedNode.position.x+70,y:selectedNode.position.y+70},data:{...selectedNode.data,config:{...selectedNode.data.config}}};setNodes(v=>[...v,n]);setSelected(n.id)};const removeSelected=()=>{if(!selected)return;pushHistory();setNodes(v=>v.filter(n=>n.id!==selected));setEdges(v=>v.filter(e=>e.source!==selected&&e.target!==selected));setSelected(null)};const undo=()=>{if(!history.length)return;const prev=history.at(-1);setNodes(prev.nodes);setEdges(prev.edges);setHistory(h=>h.slice(0,-1));};const openRun=async runId=>{setActiveExecution(runId);try{const{data}=await api.executionSteps(runId);setSteps(data.records)}catch(e){toast.error(err(e))}};const saveSchedule=async()=>{try{const local=new Date(scheduleStart);await api.createSchedule({workflowId:id,startAt:local.toISOString(),timezone,recurrenceRule:scheduleType==='once'?{type:'once'}:scheduleType==='weekly'?{type:'weekly',days:[1,2,3,4,5],time:scheduleTime}:{type:scheduleType,time:scheduleTime},maxRuns:50});toast.success('Schedule saved in MongoDB.');setScheduleModal(false);load();}catch(e){toast.error(err(e))}};
 if(busy&&!workflow&&!id)return <div className="campaign-loading"><LoaderCircle className="spin"/> Preparing editor…</div>;if(busy&&id&&!workflow)return <div className="campaign-loading"><LoaderCircle className="spin"/> Loading workflow…</div>;
 return <div className="wf-editor-page"><div className="wf-editor-toolbar"><Link to="/workflows" className="back-link"><ArrowLeft size={14}/> Workflows</Link><div className="wf-title-input"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Workflow name"/><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description (optional)"/></div><Badge value={workflow?.status||'Draft'}/><button className="outline-btn small" onClick={save} disabled={busy}><Save size={13}/> Save</button><button className="outline-btn small" onClick={validate}><ShieldCheck size={13}/> Validate</button><button className="outline-btn small" onClick={test}><Play size={13}/> Test</button>{workflow?.status==='Active'?<button className="outline-btn small" onClick={async()=>{try{const{data}=await api.pauseWorkflow(id);setWorkflow(data.workflow);toast.success('Workflow paused.')}catch(e){toast.error(err(e))}}}>Pause</button>:workflow?.status==='Published'||workflow?.status==='Paused'?<button className="outline-btn small" onClick={async()=>{try{const{data}=await api.activateWorkflow(id);setWorkflow(data.workflow);toast.success('Workflow activated.')}catch(e){toast.error(err(e))}}}>Activate</button>:<button className="outline-btn small" onClick={publish}>Publish</button>}{workflow?.status==='Active'&&<button className="primary-btn small" onClick={run}><Zap size={13}/> Run mock</button>}</div>
 <div className="wf-editor-main"><aside className="wf-node-library"><div><b>Node library</b><label><Search size={13}/><input value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Find a node"/></label></div>{['Trigger','Action','Logic','Delay','Control'].map(group=><section key={group}><h4>{group}s</h4>{Object.entries(TYPES).filter(([,v])=>v[0]===group&&v[1].toLowerCase().includes(librarySearch.toLowerCase())).map(([type,[,label]])=><button key={type} draggable onDragStart={e=>e.dataTransfer.setData('application/workflow-node',type)} onClick={()=>add(type)}><Plus size={12}/>{label}</button>)}</section>)}<div className="wf-library-note"><ShieldCheck size={14}/> Incoming WhatsApp, delivery, and read triggers remain unavailable until real provider events exist.</div></aside><section className="wf-canvas"><div className="wf-canvas-tools"><button onClick={undo} title="Undo">↶</button><button onClick={()=>rf.zoomOut()} title="Zoom out">−</button><button onClick={()=>rf.zoomIn()} title="Zoom in">+</button><button onClick={()=>rf.fitView({padding:.25})} title="Fit canvas">Fit</button><button onClick={duplicateNode} disabled={!selected}><Copy size={13}/></button><button onClick={removeSelected} disabled={!selected}><Trash2 size={13}/></button></div><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_,n)=>setSelected(n.id)} onPaneClick={()=>setSelected(null)} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}} onDrop={e=>{e.preventDefault();const type=e.dataTransfer.getData('application/workflow-node');if(type){const p=rf.screenToFlowPosition({x:e.clientX,y:e.clientY});const n=newNode(type,p.x,p.y);setNodes(v=>[...v,n]);setSelected(n.id)}}} fitView><Background color="#E2E8F0" gap={20}/><Controls/><MiniMap pannable zoomable nodeColor={n=>({Trigger:'#119d70',Logic:'#9a82d1',Delay:'#e1a14d',Action:'#68a7c3',Control:'#94A3B8'}[TYPES[n.data.nodeType]?.[0]]||'#aaa')}/></ReactFlow><div className="wf-canvas-caption">Drag from the library, or click a node to add it. Connect handles to define the path.</div></section><aside className="wf-node-config"><NodeConfig node={selectedNode} onChange={changeConfig} templates={templates} versions={versions} loadVersions={loadVersions}/></aside></div>
 <div className="wf-bottom-grid"><section className="campaign-panel wf-validation"><header><h3><ShieldCheck size={15}/> Validation</h3><button className="text-link" onClick={validate}>Run check</button></header>{validation?<>{validation.errors?.length?validation.errors.map((e,i)=><p className="wf-validation-error" key={i}><AlertTriangle size={13}/>{e}</p>):<p className="wf-validation-ok"><Check size={13}/> Graph is valid. It does not enable live WhatsApp sending.</p>}</>:<p className="wf-muted">Validate the graph before publishing.</p>}</section><section className="campaign-panel wf-runs"><header><h3><Activity size={15}/> Runs & test trace</h3><span>TEST MODE — NO REAL MESSAGES</span></header><div className="wf-test-controls"><label>Test contact<select value={selectedContact} onChange={e=>setSelectedContact(e.target.value)}><option value="">Synthetic, no contact</option>{testContacts.map(c=><option value={c._id} key={c._id}>{c.fullName} · {c.whatsappConsentStatus}</option>)}</select></label><label className="wf-check"><input type="checkbox" checked={syntheticReply} onChange={e=>setSyntheticReply(e.target.checked)}/> Synthetic reply test event</label></div><div className="wf-run-list">{runs.slice(0,6).map(r=><button className={activeExecution===r._id?'active':''} key={r._id} onClick={()=>openRun(r._id)}><Badge value={r.status}/><span>{r.executionMode.toUpperCase()} · {new Date(r.createdAt).toLocaleString()}</span></button>)}</div>{steps.length>0&&<div className="wf-step-trace">{steps.map(s=><article key={s._id}><i className={`wf-step-${s.status}`}/><b>{TYPES[s.nodeType]?.[1]||s.nodeType}</b><span>{s.outputSummary?.mode==='MOCK'?'MOCK · ':''}{s.outputSummary?.blocked||s.error||s.outputSummary?.result||s.outputSummary?.status||s.status}</span></article>)}</div>}</section></div>
 {workflow?.status==='Active'&&<section className="campaign-panel wf-schedule-panel"><header><h3><CalendarClock size={15}/> Persistent schedules</h3><button className="outline-btn small" onClick={()=>{setScheduleStart(new Date(Date.now()+3600000).toISOString().slice(0,16));setScheduleModal(true)}}><Plus size={13}/> Add schedule</button></header>{schedules.map(s=><article key={s._id}>{s.recurrenceRule.type} · {s.timezone} · next {new Date(s.nextRunAt).toLocaleString()} <Badge value={s.status}/></article>)}{!schedules.length&&<p className="wf-muted">No schedule is configured.</p>}</section>}
 {scheduleModal&&<div className="campaign-modal-scrim" onClick={()=>setScheduleModal(false)}><section className="campaign-segment-modal wf-schedule-modal" onClick={e=>e.stopPropagation()}><header><b>Schedule workflow</b><button className="icon-btn" onClick={()=>setScheduleModal(false)}><X size={16}/></button></header><label className="field">Start date and time<input type="datetime-local" value={scheduleStart} onChange={e=>setScheduleStart(e.target.value)}/></label><label className="field">IANA timezone<input value={timezone} onChange={e=>setTimezone(e.target.value)}/></label><label className="field">Recurrence<select value={scheduleType} onChange={e=>setScheduleType(e.target.value)}>{['once','daily','weekly','monthly'].map(x=><option key={x}>{x}</option>)}</select></label>{scheduleType!=='once'&&<label className="field">Local time<input type="time" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)}/></label>}<p>Runs persist in MongoDB and execute in MOCK mode only.</p><footer><button className="outline-btn" onClick={()=>setScheduleModal(false)}>Cancel</button><button className="primary-btn small" onClick={saveSchedule}>Save schedule</button></footer></section></div>}
 </div>}
export function WorkflowEditorPage(){return <ReactFlowProvider><EditorInner/></ReactFlowProvider>}
export {WorkflowsPage};
