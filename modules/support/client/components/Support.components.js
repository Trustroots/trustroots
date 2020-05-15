// // import React, { useState } from 'react';
// import React, { useState, useEffect } from 'react';
// // import ManifestoText from './ManifestoText.component.js';
// // import BoardCredits from '@/modules/core/client/components/BoardCredits.js';
// // import PropTypes from 'prop-types';
// import Tooltip from '@/modules/core/client/components/Tooltip.js';
// import { userType } from '@/modules/users/client/users.prop-types';
// import { Trans, useTranslation } from 'react-i18next';
// import Board from '@/modules/core/client/components/Board.js';
// import classnames from 'classnames';
// // import { getRouteParams } from '@/modules/core/client/services/angular-compat';
// // import getTribeBackgroundStyle from '@/modules/tribes/client/components/helpers/getTribeBackgroundStyle';
// // import * as tribesAPI from '@/modules/tribes/client/api/tribes.api';

// // const api = {
// // tribes: tribesAPI,
// // };

// // export default function Guide({ user, isNativeMobileApp, photoCredits }) {
// export default function Support({ user }) {
//   const { t } = useTranslation('pages');

//   // ---------------------------------------
//   const { tribe: tribeRoute } = getRouteParams();
//   const boardHeight = 700;

//   const [tribes, setTribes] = useState([]);

//   useEffect(() => {
//     async function fetchData() {
//      const tribes = await api.tribes.read({ limit: 3 });
//      setTribes(tribes);
//     }
//    fetchData();
//   }, []);

//   const [support, setSupport] = useState('');

//   <textarea value=support onChange={event => setSupport(event.target.value)}{}></textarea></textarea>
//   // ------------------------------------
//   function SupportController(SupportService, messageCenterService, $stateParams) {
//     // ViewModel
//     const vm = this;

//     // Exposed to the view
//     vm.sendSupportRequest = sendSupportRequest;
//     let success = false;
//     const [isLoading, setIsLoading] = useState(false);
//     const request = {
//       username: '',
//       email: '',
//       message: '',
//     };

//     const handleSendSupport = async () => {
//         setIsLoading(true);
//         await api.support.askVeryNicelyForSupport(.....);
//         setIsLoading(false);
//     }

//     <form onSubmit={handleSendSupport}></form></form>

//     activate();

//     /**
//      * Initialize controller
//      */
//     function activate() {
//       if ($stateParams.report && $stateParams.report !== '') {
//         vm.request.reportMember = $stateParams.report;
//       }
//     }

//     /**
//      * Send support request
//      */
//     function sendSupportRequest(isValid) {
//       vm.success = false;
//       vm.isLoading = true;

//       if (!isValid) {
//         vm.isLoading = false;
//         return false;
//       }

//       if (vm.request.message === '') {
//         messageCenterService.add('danger', 'Please write a message first.', {
//           timeout: 20000,
//         });
//         vm.isLoading = false;
//         return false;
//       }

//       const supportRequest = new SupportService(vm.request);

//       supportRequest.$save(
//         function() {
//           vm.success = true;
//           vm.isLoading = false;
//         },
//         function(err) {
//           vm.isLoading = false;
//           messageCenterService.add(
//             'danger',
//             err.message || 'Something went wrong. Please try again.',
//             { timeout: 20000 },
//           );
//         },
//       );
//     }
//   }

//   return (
//     <>
//       <Board namess="forestpath">
//         <div className="container">
//           <div className="row">
//             <div className="col-xs-12 text-center">
//               <br />
//               <br />
//               <h2>{t('Trustroots Support')}</h2>
//             </div>
//           </div>
//         </div>
//       </Board>

//       <section className="container container-spacer">
//         <div className="row">
//           <div className="col-xs-12 col-md-8 col-lg-7">
//             {/* Request form */}
//             {!support.success && (
//               <div className="panel panel-default">
//                 <div className="panel-heading">
//                   <h4>{t('Contact us')}</h4>
//                 </div>
//                 <div className="panel-body">
//                   <form
//                     name="supportForm"
//                     ng-submit="support.sendSupportRequest(supportForm.$valid)" // TODO
//                     noValidate
//                     autoComplete="off"
//                     className="form-horizontal"
//                   >
//                     {/* Reporting another profile */}
//                     {support.request.reportMember && (
//                       <div className="form-group">
//                         <label className="col-sm-2 control-label">
//                           {t('Reporting member')}
//                         </label>
//                         <div className="col-sm-10">
//                           <p className="form-control-static">
//                             <strong>{support.request.reportMember}</strong>
//                           </p>
//                           <p className="form-control-static">
//                             <em>
//                               {t(
//                                 'If you or someone you know have witnessed or been a victim of a crime, please report it to the police immediately.',
//                               )}
//                             </em>
//                           </p>
//                         </div>
//                       </div>
//                     )}

//                     {/* Message */}
//                     <div className="form-group">
//                       <label
//                         htmlFor="message"
//                         className="col-sm-2 control-label"
//                       >
//                         {t('Message')}
//                       </label>
//                       <div className="col-sm-10">
//                         <textarea
//                           className="form-control input-lg"
//                           rows="7"
//                           id="message"
//                           required
//                           disabled={support.isLoading}
//                           ng-model="support.request.message" // TODO
//                         ></textarea>
//                         <span className="help-block">
//                           {t('Please write in English if possible.')}
//                           <br />
//                         </span>
//                       </div>
//                     </div>

//                     {/* Name is sent only for logged in users, don't bother to ask it from non-logged users */}
//                     {user && (
//                       <div className="form-group">
//                         <label className="col-sm-2 control-label">
//                           {t('Name')}
//                         </label>
//                         <div className="col-sm-10">
//                           <p className="form-control-static">
//                             {user.displayName}
//                           </p>
//                         </div>
//                       </div>
//                     )}

//                     <div className="form-group">
//                       <label
//                         htmlFor="username"
//                         className="col-sm-2 control-label"
//                       >
//                         {t('Username')}
//                       </label>
//                       <div className="col-sm-10">
//                         {!user && (
//                           <input
//                             type="text"
//                             className="form-control input-lg"
//                             id="username"
//                             disabled={support.isLoading}
//                             ng-model="support.request.username" // TODO
//                           />
//                         )}
//                         {user && (
//                           <p className="form-control-static">{user.username}</p>
//                         )}
//                       </div>
//                     </div>

//                     <div
//                       // ng-class="{'has-error': supportForm.email.$invalid && supportForm.email.$dirty}" // TODO
//                       className={classnames('form-group', {
//                         'has-error':
//                           supportForm.email.$invalid &&
//                           supportForm.email.$dirty,
//                       })}
//                     >
//                       <label htmlFor="email" className="col-sm-2 control-label">
//                         {t('Email')}
//                       </label>
//                       <div className="col-sm-10">
//                         {!user && (
//                           // TODO
//                           <Tooltip placement="top" tooltip={supportForm.email.$error.email && supportForm.email.$dirty) ? 'Please give a valid email.' : ''}>
//                             <input
//                               type="email"
//                               mailcheck // TODO
//                               id="email"
//                               name="email"
//                               className="form-control input-lg"
//                               ng-model="support.request.email" // TODO
//                               disabled={support.isLoading}
//                               tooltip-trigger="blur" // TODO
//                             />
//                           </Tooltip>
//                         )}
//                         {user && (
//                           <p className="form-control-static">{user.email}</p>
//                         )}
//                       </div>
//                     </div>

//                     <div className="form-group">
//                       <div className="col-sm-offset-2 col-sm-10">
//                         <button
//                           type="submit"
//                           className="btn btn-lg btn-primary"
//                           disabled={support.isLoading}
//                         >
//                           {support.isLoading && <span>{t('Wait...')}</span>}
//                           {!support.isLoading && <span>{t('Send')}</span>}
//                         </button>
//                       </div>
//                     </div>
//                   </form>
//                 </div>
//               </div>
//             )}
//             {/* Request sent */}
//             {support.success && (
//               <div>
//                 <p className="lead">
//                   <em>
//                     {t('Thank you!')}
//                     <br />
//                     <br />
//                     {t(
//                       'I’m just a small website robot but I’ve sent your message to our support people. Expect them to get back to you very soon!',
//                     )}
//                     <br />
//                     <br />
//                     {t('— Trustroots Support Robot')}
//                   </em>
//                 </p>
//                 <p>
//                   <br />
//                   <br />
//                   <Trans t={t} ns="support">
//                     You could continue to <a ng-click="app.goHome()">home</a> or
//                     see <a href="/faq">frequently asked questions</a>.
//                   </Trans>
//                 </p>
//               </div>
//             )}{' '}
//           </div>
//           {/* /.col-* */}
//           <div className="col-xs-12 col-md-4 col-lg-5">
//             <h3>{t('See also')}</h3>
//             <ul className="list-unstyled lead">
//               <li>
//                 <a href="/faq">{t('Frequently asked questions')}</a>
//               </li>
//               <li>
//                 <a href="/profile/edit/account#remove">
//                   {t('Removing your account')}
//                 </a>
//               </li>
//               <li>
//                 <Trans t={t} ns="support">
//                   <a href="/volunteering">Become a volunteer</a> and make a
//                   difference!
//                 </Trans>
//               </li>
//             </ul>
//           </div>
//         </div>
//         {/* /.row */}
//       </section>
//     </>
//   );
// }

// Support.propTypes = {
//   user: userType,
//   // isNativeMobileApp: PropTypes.bool,
//   // photoCredits: PropTypes.object,
// };
