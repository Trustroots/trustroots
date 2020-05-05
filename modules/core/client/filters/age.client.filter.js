/**
 * Turn mongo date string into years
 *
 * Input: '1986-05-30' or new Date(1986, 04, 30)
 * (00 - January, 04 - May in new Date())
 * Output: 28 years
 *
 * @link http://stackoverflow.com/a/24883386
 * @link http://stackoverflow.com/a/21984136
 */
angular.module('core').filter('ageyears', ageYearsFilter);

/* @ngInject */
function ageYearsFilter($filter) {
  return function (dateStringOrDate) {
    const dateObj = new Date($filter('date')(dateStringOrDate, 'yyyy-MM-dd'));
    const ageDifMs = Date.now() - dateObj.getTime();
    const ageDate = new Date(ageDifMs); // miliseconds from epoch

    return Math.abs(ageDate.getUTCFullYear() - 1970) + ' years';
  };
}
