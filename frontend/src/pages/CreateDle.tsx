import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import useTitle from '../hooks/useTitle';
import { uploadImage } from '../services/cloudinaryService';
import customDleService from '../services/customDleService';
import type { Attribute } from '../types/anime';
import type {
  CustomCharacter,
  CreateCustomDlePayload,
  Visibility,
} from '../types/customDle';
import { AttributeType } from '../constants/enums';
import './CreateDle.css';

type Step = 1 | 2 | 3;

interface EditorAttribute extends Attribute {
  orderText?: string;
  optionsText?: string;
}

const TYPE_META: Record<AttributeType, { icon: string; label: string; hint: string; color: string }> = {
  [AttributeType.Text]:    { icon: 'Aa', label: 'Texte',    hint: 'Texte libre, comparaison exacte',                   color: 'slate'   },
  [AttributeType.Number]:  { icon: '123', label: 'Nombre',  hint: 'Valeur chiffrée, indicateur ▲/▼',                   color: 'cyan'    },
  [AttributeType.Ordered]: { icon: '⇅',  label: 'Ordonné', hint: 'Liste ordonnée (ex: Faible < Moyen < Fort)',        color: 'amber'   },
  [AttributeType.Multi]:   { icon: '⋮⋮',  label: 'Multi',   hint: 'Sélection multiple depuis un pool de valeurs',      color: 'magenta' },
  [AttributeType.Boolean]: { icon: '✓✗',  label: 'Booléen', hint: 'Vrai ou Faux',                                      color: 'purple'  },
};

export default function CreateDle() {
  const { id: editId } = useParams();
  const isEdit = !!editId;
  useTitle(isEdit ? 'Modifier un DLE' : 'Créer un DLE');
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);

  // Étape 1
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [maxAttempts, setMaxAttempts] = useState(10);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [existingIcon, setExistingIcon] = useState<{ url: string | null; publicId: string | null }>({ url: null, publicId: null });
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [existingBackground, setExistingBackground] = useState<{ url: string | null; publicId: string | null }>({ url: null, publicId: null });

  // Étape 2
  const [attributes, setAttributes] = useState<EditorAttribute[]>([
    { key: 'role', label: 'Rôle', type: AttributeType.Text },
  ]);

  // Étape 3
  const [characters, setCharacters] = useState<CustomCharacter[]>([]);
  const [uploading, setUploading] = useState<Set<number>>(new Set());

  // Chargement des données existantes en mode édition
  useEffect(() => {
    if (!isEdit || !editId) return;
    customDleService.getGame(editId)
      .then((dle) => {
        setName(dle.name);
        setVisibility(dle.visibility);
        setMaxAttempts(dle.maxAttempts);
        setExistingIcon({ url: dle.icon, publicId: null });
        setIconPreview(dle.icon);
        setExistingBackground({ url: dle.background, publicId: null });
        setBackgroundPreview(dle.background);
        setAttributes(dle.attributes.map((a) => ({
          ...a,
          orderText: a.order?.join(', ') || '',
          optionsText: a.options?.join(', ') || '',
        })));
        setCharacters(dle.characters.map((c) => ({ ...c })));
        setLoadingExisting(false);
      })
      .catch((e) => {
        setError(e.message || 'Impossible de charger ce DLE');
        setLoadingExisting(false);
      });
  }, [isEdit, editId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, kind: 'icon' | 'background') {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (kind === 'icon') { setIconFile(file); setIconPreview(preview); }
    else { setBackgroundFile(file); setBackgroundPreview(preview); }
  }

  function addAttribute() {
    if (attributes.length >= 15) return;
    setAttributes([...attributes, { key: `attr_${attributes.length + 1}`, label: '', type: AttributeType.Text }]);
  }

  function updateAttribute(i: number, patch: Partial<EditorAttribute>) {
    setAttributes(attrs => attrs.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  function removeAttribute(i: number) {
    setAttributes(attrs => attrs.filter((_, idx) => idx !== i));
  }

  function addCharacter() {
    if (characters.length >= 80) return;
    setCharacters(chars => [...chars, { id: `char_${Date.now()}_${chars.length}`, name: '', image: '' }]);
  }

  function updateCharacter(i: number, patch: Partial<CustomCharacter>) {
    setCharacters(chars => chars.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function removeCharacter(i: number) {
    setCharacters(chars => chars.filter((_, idx) => idx !== i));
  }

  async function handleCharacterImage(file: File, i: number) {
    setUploading(u => new Set(u).add(i));
    try {
      const result = await uploadImage(file, 'character');
      updateCharacter(i, { image: result.url, imagePublicId: result.publicId });
    } catch (err: any) {
      setError(err.message || 'Erreur upload');
    } finally {
      setUploading(u => { const n = new Set(u); n.delete(i); return n; });
    }
  }

  function validateStep1(): string | null {
    if (name.trim().length < 2) return 'Nom trop court (min 2 caractères)';
    if (maxAttempts < 3 || maxAttempts > 50) return "Nombre d'essais entre 3 et 50";
    return null;
  }

  function validateStep2(): string | null {
    if (attributes.length === 0) return 'Au moins 1 attribut requis';
    for (const a of attributes) {
      if (!a.key || !a.label) return 'Clé et label requis pour chaque attribut';
      if (!/^[a-z0-9_]+$/i.test(a.key)) return `Clé invalide: ${a.key}`;
      if (a.type === AttributeType.Ordered && (!a.orderText || a.orderText.trim().length === 0))
        return `Valeurs ordonnées manquantes pour ${a.label}`;
      if (a.type === AttributeType.Multi && (!a.optionsText || a.optionsText.trim().length === 0))
        return `Options manquantes pour ${a.label}`;
    }
    const keys = attributes.map(a => a.key);
    if (new Set(keys).size !== keys.length) return 'Les clés doivent être uniques';
    return null;
  }

  function validateStep3(): string | null {
    if (characters.length < 2) return 'Au moins 2 personnages requis';
    for (const c of characters) {
      if (!c.name.trim()) return 'Chaque personnage doit avoir un nom';
      if (!c.image) return `Image manquante pour "${c.name || 'un perso'}"`;
    }
    return null;
  }

  function next() {
    setError(null);
    const err = step === 1 ? validateStep1() : step === 2 ? validateStep2() : null;
    if (err) return setError(err);
    setStep((s) => (s + 1) as Step);
  }

  async function submit() {
    setError(null);
    const err = validateStep3();
    if (err) return setError(err);
    setSubmitting(true);
    try {
      const [icon, bg] = await Promise.all([
        iconFile ? uploadImage(iconFile, 'character') : Promise.resolve(null),
        backgroundFile ? uploadImage(backgroundFile, 'background') : Promise.resolve(null),
      ]);

      const attrs: Attribute[] = attributes.map((a) => ({
        key: a.key,
        label: a.label,
        type: a.type,
        order: a.type === AttributeType.Ordered ? parseList(a.orderText) : undefined,
        options: a.type === AttributeType.Multi ? parseList(a.optionsText) : undefined,
      }));

      const payload: CreateCustomDlePayload = {
        name: name.trim(),
        iconUrl: icon ? icon.url : existingIcon.url,
        iconPublicId: icon ? icon.publicId : existingIcon.publicId,
        backgroundUrl: bg ? bg.url : existingBackground.url,
        backgroundPublicId: bg ? bg.publicId : existingBackground.publicId,
        maxAttempts,
        attributes: attrs,
        characters,
        visibility,
      };

      if (isEdit && editId) {
        await customDleService.update(editId, payload);
        navigate(`/custom/${editId}`);
      } else {
        const { id } = await customDleService.create(payload);
        navigate(`/custom/${id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur ' + (isEdit ? 'modification' : 'création'));
      setSubmitting(false);
    }
  }

  const resolvedAttributes: Attribute[] = attributes.map((a) => ({
    key: a.key,
    label: a.label,
    type: a.type,
    order: a.type === AttributeType.Ordered ? parseList(a.orderText) : undefined,
    options: a.type === AttributeType.Multi ? parseList(a.optionsText) : undefined,
  }));

  if (loadingExisting) {
    return (
      <div className="create-dle">
        <div className="loading">Chargement du DLE...</div>
      </div>
    );
  }

  return (
    <div className="create-dle">
      <header className="cd-header">
        <Link to={isEdit && editId ? `/custom/${editId}` : '/'} className="cd-back">← {isEdit ? 'Retour au DLE' : 'Accueil'}</Link>
        <h1 className="cd-title">{isEdit ? 'Modifier le DLE' : 'Créer un DLE'}</h1>
        <Stepper step={step} />
      </header>

      {error && <div className="cd-error" onClick={() => setError(null)}>{error} <span>×</span></div>}

      <main className="cd-main">
        {step === 1 && (
          <StepInfos
            name={name} setName={setName}
            visibility={visibility} setVisibility={setVisibility}
            maxAttempts={maxAttempts} setMaxAttempts={setMaxAttempts}
            iconPreview={iconPreview} backgroundPreview={backgroundPreview}
            onFileChange={handleFileChange}
          />
        )}

        {step === 2 && (
          <StepAttributes
            attributes={attributes}
            onAdd={addAttribute}
            onUpdate={updateAttribute}
            onRemove={removeAttribute}
          />
        )}

        {step === 3 && (
          <StepCharacters
            attributes={resolvedAttributes}
            characters={characters}
            uploading={uploading}
            onAdd={addCharacter}
            onUpdate={updateCharacter}
            onRemove={removeCharacter}
            onImage={handleCharacterImage}
          />
        )}
      </main>

      <footer className="cd-footer">
        {step > 1 ? (
          <button className="cd-btn-ghost" onClick={() => setStep((s) => (s - 1) as Step)}>← Retour</button>
        ) : <span />}
        <div className="cd-progress-text">Étape {step} / 3</div>
        {step < 3 ? (
          <button className="cd-btn-primary" onClick={next}>Suivant →</button>
        ) : (
          <button className="cd-btn-primary" onClick={submit} disabled={submitting}>
            {submitting
              ? (isEdit ? 'Enregistrement...' : 'Création...')
              : (isEdit ? '✓ Enregistrer' : '✓ Créer le DLE')}
          </button>
        )}
      </footer>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function Stepper({ step }: { step: Step }) {
  const labels = ['Infos', 'Attributs', 'Persos'];
  return (
    <div className="cd-stepper">
      {labels.map((label, i) => {
        const n = i + 1;
        const state = step === n ? 'active' : step > n ? 'done' : 'pending';
        return (
          <div key={n} className={`cd-step ${state}`}>
            <div className="cd-step-dot">{state === 'done' ? '✓' : n}</div>
            <span className="cd-step-label">{label}</span>
            {n < 3 && <div className="cd-step-line" />}
          </div>
        );
      })}
    </div>
  );
}

function StepInfos(props: {
  name: string; setName: (v: string) => void;
  visibility: Visibility; setVisibility: (v: Visibility) => void;
  maxAttempts: number; setMaxAttempts: (v: number) => void;
  iconPreview: string | null; backgroundPreview: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, kind: 'icon' | 'background') => void;
}) {
  const { name, setName, visibility, setVisibility, maxAttempts, setMaxAttempts, iconPreview, backgroundPreview, onFileChange } = props;

  return (
    <section className="cd-section">
      <div className="cd-section-head">
        <h2>Informations générales</h2>
        <p>Nomme ton DLE, choisis sa visibilité et uploade ses visuels.</p>
      </div>

      <div className="cd-grid cd-grid-2">
        <div className="cd-field">
          <label>Nom du DLE</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex: Demon Slayer" />
        </div>

        <div className="cd-field">
          <label>Nombre d'essais</label>
          <input type="number" min={3} max={50} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} />
        </div>
      </div>

      <div className="cd-field">
        <label>Visibilité</label>
        <div className="cd-visibility-choice">
          {(['private', 'unlisted', 'public'] as Visibility[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`cd-vis-option ${visibility === v ? 'active' : ''}`}
              onClick={() => setVisibility(v)}
            >
              <div className="cd-vis-icon">{v === 'private' ? '🔒' : v === 'unlisted' ? '🔗' : '🌍'}</div>
              <div className="cd-vis-body">
                <strong>{v === 'private' ? 'Privé' : v === 'unlisted' ? 'Non listé' : 'Public'}</strong>
                <span>
                  {v === 'private' && 'Visible uniquement par toi'}
                  {v === 'unlisted' && 'Accessible avec le lien'}
                  {v === 'public' && 'Listé dans la galerie publique'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="cd-grid cd-grid-2">
        <DropUpload label="Icône (carré recommandé)" preview={iconPreview} onFile={(f) => onFileChange({ target: { files: [f] } } as any, 'icon')} shape="square" />
        <DropUpload label="Fond d'écran (paysage)" preview={backgroundPreview} onFile={(f) => onFileChange({ target: { files: [f] } } as any, 'background')} shape="wide" />
      </div>
    </section>
  );
}

function DropUpload({ label, preview, onFile, shape }: {
  label: string; preview: string | null; onFile: (f: File) => void; shape: 'square' | 'wide';
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="cd-field">
      <label>{label}</label>
      <div
        className={`cd-drop cd-drop-${shape} ${dragging ? 'drag' : ''} ${preview ? 'has-preview' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="preview" />
        ) : (
          <div className="cd-drop-hint">
            <div className="cd-drop-icon">⬆</div>
            <span>Glisse une image ou clique</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          hidden
        />
      </div>
    </div>
  );
}

function StepAttributes({ attributes, onAdd, onUpdate, onRemove }: {
  attributes: EditorAttribute[];
  onAdd: () => void;
  onUpdate: (i: number, patch: Partial<EditorAttribute>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <section className="cd-section">
      <div className="cd-section-head">
        <h2>Attributs</h2>
        <p>Ces champs définissent ce que le joueur va deviner pour chaque perso (max 15).</p>
      </div>

      <div className="cd-attrs">
        {attributes.map((a, i) => (
          <AttributeCard key={i} attr={a} onChange={(patch) => onUpdate(i, patch)} onRemove={() => onRemove(i)} />
        ))}
      </div>

      <button className="cd-btn-add" onClick={onAdd} disabled={attributes.length >= 15}>
        <span>+</span> Ajouter un attribut
      </button>
    </section>
  );
}

function AttributeCard({ attr, onChange, onRemove }: {
  attr: EditorAttribute;
  onChange: (patch: Partial<EditorAttribute>) => void;
  onRemove: () => void;
}) {
  const meta = TYPE_META[attr.type];
  return (
    <div className={`cd-attr-card cd-color-${meta.color}`}>
      <div className="cd-attr-top">
        <div className="cd-attr-type-badge">
          <span className="cd-attr-icon">{meta.icon}</span>
          <span>{meta.label}</span>
        </div>
        <button className="cd-btn-remove" onClick={onRemove} title="Supprimer">×</button>
      </div>

      <div className="cd-grid cd-grid-2">
        <div className="cd-field">
          <label>Clé <span className="cd-label-hint">technique, lettres/chiffres/_</span></label>
          <input value={attr.key} onChange={(e) => onChange({ key: e.target.value })} placeholder="ex: power" />
        </div>
        <div className="cd-field">
          <label>Label</label>
          <input value={attr.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="ex: Puissance" />
        </div>
      </div>

      <div className="cd-field">
        <label>Type</label>
        <div className="cd-type-tabs">
          {(Object.keys(TYPE_META) as AttributeType[]).map((t) => {
            const m = TYPE_META[t];
            return (
              <button
                key={t}
                type="button"
                className={`cd-type-tab cd-color-${m.color} ${attr.type === t ? 'active' : ''}`}
                onClick={() => onChange({ type: t })}
                title={m.hint}
              >
                <span className="cd-type-tab-icon">{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
        <p className="cd-type-hint">{meta.hint}</p>
      </div>

      {attr.type === AttributeType.Ordered && (
        <div className="cd-field">
          <label>Valeurs ordonnées <span className="cd-label-hint">séparées par virgule, du + petit au + grand</span></label>
          <input
            value={attr.orderText || ''}
            onChange={(e) => onChange({ orderText: e.target.value })}
            placeholder="ex: Faible, Moyen, Fort, Extrême"
          />
        </div>
      )}

      {attr.type === AttributeType.Multi && (
        <div className="cd-field">
          <label>Options disponibles <span className="cd-label-hint">séparées par virgule — le joueur en pick plusieurs</span></label>
          <input
            value={attr.optionsText || ''}
            onChange={(e) => onChange({ optionsText: e.target.value })}
            placeholder="ex: Feu, Eau, Foudre, Glace"
          />
        </div>
      )}
    </div>
  );
}

function StepCharacters({ attributes, characters, uploading, onAdd, onUpdate, onRemove, onImage }: {
  attributes: Attribute[];
  characters: CustomCharacter[];
  uploading: Set<number>;
  onAdd: () => void;
  onUpdate: (i: number, patch: Partial<CustomCharacter>) => void;
  onRemove: (i: number) => void;
  onImage: (file: File, i: number) => void;
}) {
  return (
    <section className="cd-section">
      <div className="cd-section-head">
        <h2>Personnages</h2>
        <p>Chaque ligne = un perso. Les cellules adaptent leur input selon le type d'attribut (max 80).</p>
      </div>

      {characters.length === 0 ? (
        <div className="cd-empty">
          <div className="cd-empty-icon">👥</div>
          <p>Aucun personnage pour le moment.</p>
          <button className="cd-btn-primary" onClick={onAdd}>+ Ajouter le premier</button>
        </div>
      ) : (
        <>
          <div className="cd-table-wrap">
            <table className="cd-table">
              <thead>
                <tr>
                  <th className="cd-th-num">#</th>
                  <th className="cd-th-img">Image</th>
                  <th className="cd-th-name">Nom</th>
                  {attributes.map((a) => (
                    <th key={a.key} title={TYPE_META[a.type]?.hint}>
                      <span className="cd-th-label">{a.label || a.key}</span>
                      <span className={`cd-th-type cd-color-${TYPE_META[a.type]?.color}`}>{TYPE_META[a.type]?.icon}</span>
                    </th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {characters.map((c, i) => (
                  <tr key={c.id}>
                    <td className="cd-td-num">{i + 1}</td>
                    <td className="cd-td-img">
                      <ImageCell image={c.image} uploading={uploading.has(i)} onFile={(f) => onImage(f, i)} />
                    </td>
                    <td>
                      <input
                        value={c.name}
                        onChange={(e) => onUpdate(i, { name: e.target.value })}
                        placeholder="Nom"
                        className="cd-cell-input"
                      />
                    </td>
                    {attributes.map((a) => (
                      <td key={a.key}>
                        <AttrCell
                          attribute={a}
                          value={(c[a.key] as string | number) ?? ''}
                          onChange={(v) => onUpdate(i, { [a.key]: v })}
                        />
                      </td>
                    ))}
                    <td>
                      <button className="cd-btn-remove" onClick={() => onRemove(i)} title="Supprimer">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="cd-btn-add" onClick={onAdd} disabled={characters.length >= 80}>
            <span>+</span> Ajouter un personnage ({characters.length}/80)
          </button>
        </>
      )}
    </section>
  );
}

function ImageCell({ image, uploading, onFile }: {
  image: string; uploading: boolean; onFile: (f: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`cd-img-cell ${drag ? 'drag' : ''} ${uploading ? 'uploading' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
    >
      {uploading && <div className="cd-spinner" />}
      {!uploading && image && <img src={image} alt="" />}
      {!uploading && !image && <span className="cd-img-placeholder">+</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

function AttrCell({ attribute, value, onChange }: {
  attribute: Attribute;
  value: string | number;
  onChange: (value: string | number) => void;
}) {
  if (attribute.type === AttributeType.Number) {
    return (
      <input
        type="number"
        value={value === '' || value === undefined ? '' : value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="cd-cell-input cd-cell-num"
        placeholder="0"
      />
    );
  }

  if (attribute.type === AttributeType.Ordered) {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className="cd-cell-input cd-cell-select"
      >
        <option value="">—</option>
        {(attribute.order || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (attribute.type === AttributeType.Multi) {
    return (
      <MultiSelect
        value={String(value ?? '')}
        options={attribute.options || []}
        onChange={onChange}
      />
    );
  }

  if (attribute.type === AttributeType.Boolean) {
    const isTrue = String(value ?? '').toLowerCase() === 'true';
    return (
      <select
        value={isTrue ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value)}
        className="cd-cell-input cd-cell-select"
      >
        <option value="true">Vrai</option>
        <option value="false">Faux</option>
      </select>
    );
  }

  return (
    <input
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className="cd-cell-input"
      placeholder="—"
    />
  );
}

function MultiSelect({ value, options, onChange }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = new Set(value.split(',').map((v) => v.trim()).filter(Boolean));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function toggle(opt: string) {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt); else next.add(opt);
    onChange([...next].join(', '));
  }

  return (
    <div className="cd-multi" ref={ref}>
      <button type="button" className="cd-multi-btn" onClick={() => setOpen((o) => !o)}>
        {selected.size === 0 ? <span className="cd-multi-empty">—</span> : (
          <div className="cd-multi-chips">
            {[...selected].map((v) => (
              <span key={v} className="cd-multi-chip">{v}</span>
            ))}
          </div>
        )}
        <span className="cd-multi-caret">▾</span>
      </button>
      {open && (
        <div className="cd-multi-pop">
          {options.length === 0 ? (
            <div className="cd-multi-empty-hint">Aucune option définie à l'étape 2</div>
          ) : options.map((opt) => (
            <label key={opt} className="cd-multi-opt">
              <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function parseList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const list = value.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}
