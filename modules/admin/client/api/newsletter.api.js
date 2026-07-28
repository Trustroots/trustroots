import axios from 'axios';

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
