import React from 'react';
import PropTypes from 'prop-types';
import LanguageSwitch from '@/modules/core/client/components/LanguageSwitch.component';
import '@/config/lib/i18n';
import { withNamespaces } from 'react-i18next';

export function InterfaceLanguagePanel({ t }) {
  return (
    <div className="panel panel-default" id="locale">
      <div className="panel-heading">
        {t('Interface language')}
      </div>
      <div className="panel-body">

        <form>
          <div className="form-horizontal">

            <div className="form-group">
              <label className="col-sm-3 text-right control-label">{t('Change language')}</label>
              <div className="col-sm-9">

                <div className="form-group">
                  <div className="col-sm-9 col-md-7 col-lg-6">
                    <LanguageSwitch
                      presentation="select"
                      saveToAPI={true}
                    />
                  </div>
                </div>

                <p className="help-block"><small>{t('This is the language of the interface you see across the site.')}</small></p>
                <p className="help-block"><small>{t('Thanks to all our community members who helped translate!')} <a href="/volunteering">{t('You can help us out!')}</a></small></p>

              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}

const InterfaceLanguagePanelHOC = withNamespaces('user')(InterfaceLanguagePanel);

InterfaceLanguagePanelHOC.propTypes = {};

Object.defineProperty(InterfaceLanguagePanelHOC, 'name', { value: InterfaceLanguagePanel.name });

InterfaceLanguagePanel.propTypes = {
  t: PropTypes.func.isRequired
};

export default InterfaceLanguagePanelHOC;
