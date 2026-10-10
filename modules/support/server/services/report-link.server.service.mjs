import mongoose from 'mongoose';

/** Historical usernames are not evidence. Only accept an administrator's verified mapping. */
export async function linkHistoricalReport(
  { requestId, reportedUserId, evidence },
  actorId,
  apply = false,
) {
  const User = mongoose.model('User');
  const SupportRequest = mongoose.model('SupportRequest');
  const validId = value =>
    typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
  if (
    ![requestId, reportedUserId].every(validId) ||
    typeof evidence !== 'string' ||
    !evidence.trim()
  ) {
    throw new Error(
      'Each mapping requires requestId, reportedUserId and historical identity evidence.',
    );
  }
  const actor = await User.findById(actorId).select('roles').lean();
  if (!actor?.roles.includes('admin'))
    throw new Error('An administrator must verify historical mappings.');
  const report = await SupportRequest.findById(requestId).lean();
  const target = await User.findById(reportedUserId).select('created').lean();
  if (
    !report ||
    report.category !== 'reportMember' ||
    !report.user ||
    !target ||
    target._id.equals(report.user) ||
    target.created > report.sent ||
    !(await User.exists({ _id: report.user }))
  ) {
    throw new Error(
      'The historical report does not have a verifiable member pair.',
    );
  }
  if (
    report.reportedUser &&
    report.reportedUser.toString() !== reportedUserId
  ) {
    throw new Error('The report is already linked to another member.');
  }
  if (apply) {
    await mongoose.model('AuditLog').create({
      user: actorId,
      route: 'maintenance/link-support-report',
      body: { requestId, reportedUserId, evidence: evidence.trim() },
    });
    await SupportRequest.updateOne(
      {
        _id: report._id,
        reportedUser: report.reportedUser || { $exists: false },
      },
      {
        $set: {
          reportedUser: reportedUserId,
          linkageEvidence: evidence.trim(),
        },
      },
    );
  }
  return { requestId, reportedUserId, applied: apply };
}
const api = { linkHistoricalReport };
export default api;
export { api as 'module.exports' };
