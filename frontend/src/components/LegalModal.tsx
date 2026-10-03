import { useI18n } from '../i18n/I18nProvider';
import { Modal } from './Modal';
import { getLegalDocument, type LegalKind } from '../legal/legalTexts';

/** Shows the Terms & Conditions or the Privacy Policy in the current language. */
export function LegalModal({ kind, onClose }: { kind: LegalKind; onClose: () => void }) {
  const { language, t } = useI18n();
  const doc = getLegalDocument(kind, language);

  return (
    <Modal
      title={doc.title}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            className="rounded-md bg-accent-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
          >
            {t('common.close')}
          </button>
        </div>
      }
    >
      <p className="mb-1 text-xs text-neutral-500">{doc.updated}</p>
      <p className="mb-5 text-sm leading-relaxed text-neutral-700">{doc.intro}</p>
      <div className="space-y-5">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h3 className="mb-1.5 text-sm font-semibold text-neutral-900">{section.heading}</h3>
            <div className="space-y-2 text-sm leading-relaxed text-neutral-700">
              {section.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
