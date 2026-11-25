import React, { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@trustroots/ui/Modal';
import { Textarea } from '@trustroots/ui/Textarea';
import { getErrorMessage } from '@trustroots/core/http-client';
import RichText from '@/modules/core/client/components/RichText';
import { editTribe, type TribeSummary } from '../api/tribes.api';

export default function EditCircle({
  tribe,
  onSave,
}: {
  tribe: TribeSummary;
  onSave: (saved: TribeSummary) => void;
}) {
  const { t } = useTranslation('circles');
  const [draft, setDraft] = useState<{ label: string; description: string }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const labelChanged = draft !== undefined && draft.label !== tribe.label;
  const descriptionChanged =
    draft !== undefined && draft.description !== (tribe.description ?? '');

  function openEditor() {
    setError('');
    setDraft({ label: tribe.label, description: tribe.description ?? '' });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving || (!labelChanged && !descriptionChanged)) return;
    setSaving(true);
    setError('');
    try {
      const saved = await editTribe(tribe.slug, {
        ...(labelChanged && { label: draft.label }),
        ...(descriptionChanged && { description: draft.description }),
      });
      onSave(saved);
      setDraft(undefined);
    } catch (error) {
      setError(getErrorMessage(error, t('Could not save the circle.')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={openEditor}>{t('Edit circle')}</Button>
      <Modal
        open={draft !== undefined}
        onClose={() => setDraft(undefined)}
        dismissible={!saving}
      >
        {draft && (
          <form onSubmit={save}>
            <ModalHeader>
              <ModalTitle>{t('Edit circle')}</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="tw:mb-4">
                <label htmlFor="edit-circle-name">{t('Circle name')}</label>
                <Input
                  id="edit-circle-name"
                  value={draft.label}
                  onChange={event =>
                    setDraft({ ...draft, label: event.target.value })
                  }
                  required
                  minLength={2}
                  maxLength={255}
                  disabled={saving}
                />
              </div>
              <div className="tw:mb-4">
                <label htmlFor="edit-circle-description">
                  {t('Description')}
                </label>
                <Textarea
                  id="edit-circle-description"
                  className="tw:h-auto"
                  value={draft.description}
                  onChange={event =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  maxLength={4000}
                  rows={5}
                  disabled={saving}
                />
              </div>
              {draft.description && (
                <section aria-label={t('Description preview')}>
                  <h3 className="tw:mt-0 tw:text-base">
                    {t('Description preview')}
                  </h3>
                  <RichText
                    content={draft.description}
                    allowLinks
                    allowMarkdownLinks
                  />
                </section>
              )}
              {error && <p role="alert">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                disabled={saving}
                onClick={() => setDraft(undefined)}
              >
                {t('Cancel')}
              </Button>
              <Button
                type="submit"
                intent="primary"
                disabled={saving || (!labelChanged && !descriptionChanged)}
              >
                {t('Save circle')}
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </>
  );
}
