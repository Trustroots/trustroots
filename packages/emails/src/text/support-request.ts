import { text } from './text.ts';

interface Params {
  request: {
    categoryLabel?: string;
    reportMember?: string;
    message?: string;
    username?: string;
    email?: string;
    authenticated?: boolean;
    userAgent?: string;
    userId?: string;
    profilePublic?: boolean;
    signupDate?: string;
    emailTemp?: string;
    build?: {
      committedAt?: string;
      shortCommit?: string;
      branch?: string;
      commitUrl?: string;
    };
  };
}

export default function supportRequest({ request: r }: Params): string {
  return text`Category: ${r.categoryLabel}
${
  r.reportMember
    ? text`Reported member: ${r.reportMember}
`
    : ''
}
${r.message}


--${' '}
From username: ${r.username}
Email: ${r.email}
Authenticated: ${r.authenticated}
Browser: ${r.userAgent}
${
  r.build
    ? text`Code version: ${r.build.committedAt} UTC (${r.build.shortCommit})
${
  r.build.branch && r.build.branch !== 'main'
    ? text`Branch: ${r.build.branch}
`
    : ''
}
Commit: ${r.build.commitUrl}
`
    : ''
}
ID: ${r.userId}
Signup confirmed: ${r.profilePublic}
Signup date: ${r.signupDate}
${r.emailTemp ? text`Active email change: ${r.emailTemp}` : ''}
`.value;
}
