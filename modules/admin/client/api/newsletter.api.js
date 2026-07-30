import axios from 'axios';

export async function getNewsletterSubscribersCsv() {
  const { data } = await axios.get('/api/admin/newsletter-subscribers', {
    responseType: 'text',
  });
  return data;
}

export async function getNewsletterCircleSubscribersCsv(circleId) {
  const { data } = await axios.get('/api/admin/newsletter-subscribers/circle', {
    params: { circleId },
    responseType: 'text',
  });
  return data;
}

export async function previewNewsletterAudience(criteria) {
  const { data } = await axios.post(
    '/api/admin/newsletter-subscribers/audience',
    {
      ...criteria,
      format: 'preview',
    },
  );
  return data;
}

export async function getNewsletterAudienceCsv(criteria) {
  const { data } = await axios.post(
    '/api/admin/newsletter-subscribers/audience',
    {
      ...criteria,
      format: 'csv',
    },
    {
      responseType: 'text',
    },
  );
  return data;
}

export async function splitNewsletterSubscribers(newsletterCsvFile) {
  const formData = new FormData();
  formData.append('newsletterCsv', newsletterCsvFile);

  const { data } = await axios.post(
    '/api/admin/newsletter-subscribers/split',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );

  return data;
}
