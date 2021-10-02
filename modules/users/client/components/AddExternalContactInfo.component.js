import React, { useState } from 'react';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';

export default function AddExternalContactInfo() {
  const { t } = useTranslation('users');
  // `value` will be the parsed phone number in E.164 format.
  // Example: "+12133734253".
  const [value, setValue] = useState();
  function save() {
    const body = {
      user: this.state.user,
      externalContact: value,
    };

    fetch('http://localhost:3000/addexternalcontact', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  return (
    <div className="panel panel-default" id="locale">
      <div className="panel-heading">{t('Add external contact info')}</div>
      <div className="panel-body">
        <form>
          <div className="form-horizontal">
            <div className="form-group">
              <label className="col-sm-3 text-right control-label">
                {t('Add WhatsApp')}
              </label>
            </div>
            <PhoneInput
              placeholder="Enter phone number"
              value={value}
              onChange={setValue}
            />
          </div>
          <br />
          <button
            className="col-sm-2 btn btn-md btn-primary"
            type="submit"
            onClick={save}
          >
            <span className="hidden-xs">&nbsp;{t('Save')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

AddExternalContactInfo.propTypes = {};
