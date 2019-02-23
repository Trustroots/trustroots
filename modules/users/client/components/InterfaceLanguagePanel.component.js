import React from 'react';
import LanguageSwitch from '@/modules/core/client/components/LanguageSwitch.component';

export default function InterfaceLanguagePanel() {
  return (
    <div className="panel panel-default" id="locale">
      <div className="panel-heading">
        Interface language
      </div>
      <div className="panel-body">

        <form>
          <div className="form-horizontal">

            <div className="form-group">
              <label className="col-sm-3 text-right control-label">Change language</label>
              <div className="col-sm-9">

                <div className="form-group">
                  <div className="col-sm-9 col-md-7 col-lg-6">
                    <LanguageSwitch presentation="select" />
                  </div>
                </div>

                <p className="help-block"><small>This is the language of the interface you see across the site.</small></p>
                <p className="help-block"><small>Thanks to all our community members who helped translate! <a href="/volunteering">You can help us out!</a></small></p>

              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}

InterfaceLanguagePanel.propTypes = {};
