import type { Types } from 'mongoose';

import type {
  AdminExperienceChangeRequest,
  AdminExperienceChangeSearchExperience,
} from '@/modules/admin/shared/admin-experience-change';
import type {
  ExperienceChangeAccess,
  ExperienceChangeRequestSummary,
  ExperienceChangeSubmission,
} from '@/modules/experiences/shared/experience-change';

/** Compile-only checks for the native database and serialised client contracts. */
function checkExperienceChangeContracts(id: Types.ObjectId) {
  const access: ExperienceChangeAccess<Types.ObjectId> = {
    _id: id,
    public: true,
    canEdit: true,
  };
  const request: ExperienceChangeRequestSummary<Types.ObjectId, Date> = {
    _id: id,
    kind: 'edit',
    status: 'pending',
    createdAt: new Date(),
  };
  const search: AdminExperienceChangeSearchExperience<Types.ObjectId, Date> = {
    _id: id,
    created: new Date(),
    public: true,
    recommend: 'yes',
    userFrom: { _id: id },
    userTo: null,
  };
  const queued: AdminExperienceChangeRequest<Types.ObjectId, Date> = {
    _id: id,
    requester: { _id: id },
    experience: {
      _id: id,
      created: new Date(),
      public: true,
      recommend: 'yes',
      userFrom: id,
      userTo: id,
    },
    status: 'processing',
    kind: 'remove',
  };
  const edit: ExperienceChangeSubmission = {
    kind: 'edit',
    proposed: {
      feedbackPublic: 'An anonymous revised Experience.',
      recommend: 'no',
      interactions: { met: true, guest: false, host: false },
    },
  };

  const wrongAccessId: ExperienceChangeAccess<Types.ObjectId> = {
    // @ts-expect-error The member API returns native identifiers before JSON serialisation.
    _id: 'not-an-object-id',
    public: true,
    canEdit: false,
  };
  const wrongCreatedAt: ExperienceChangeRequestSummary<Types.ObjectId, Date> = {
    _id: id,
    kind: 'remove',
    status: 'pending',
    // @ts-expect-error Server query results contain native Date values.
    createdAt: '2026-10-13T00:00:00.000Z',
  };
  const wrongQueueMember: AdminExperienceChangeRequest<Types.ObjectId, Date> = {
    _id: id,
    requester: { _id: id },
    experience: {
      _id: id,
      created: new Date(),
      public: true,
      recommend: 'yes',
      // @ts-expect-error Queue member references remain unpopulated ObjectIds.
      userFrom: { _id: id },
      userTo: id,
    },
    status: 'pending',
    kind: 'remove',
  };
  const wrongProposal: ExperienceChangeSubmission = {
    kind: 'edit',
    proposed: {
      feedbackPublic: 'An anonymous revised Experience.',
      // @ts-expect-error Unsupported recommendations are rejected at the request boundary.
      recommend: 'sometimes',
      interactions: { met: true, guest: false, host: false },
    },
  };

  return {
    access,
    request,
    search,
    queued,
    edit,
    wrongAccessId,
    wrongCreatedAt,
    wrongQueueMember,
    wrongProposal,
  };
}

void checkExperienceChangeContracts;
