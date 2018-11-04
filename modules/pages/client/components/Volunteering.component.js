import React from 'react';
import { selectPhoto } from '@/modules/core/client/services/photos.service';

export default function Volunteering() {
  const photo = selectPhoto('happyhippies');
  return <>
    <section className="board volunteer-header board-happyhippies" style={{ backgroundImage: `url("${photo.imageUrl}")` }}>
      <div className="container">
        <div className="row">
          <div className="col-xs-12 text-center">
            <br/><br/>
            <i className="icon-3x icon-heart-o"></i>
            <br/><br/>
            <h2>Volunteering</h2>
          </div>
        </div>
      </div>
      <div></div>
    </section>
    <section className="container container-spacer">
      <div className="row">
        <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8">
          <p className="lead">Help us build Trustroots! Nobody can do everything, but everyone can do something... </p>
        </div>

        <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8">
          <ul>
            <li>
              <strong><em>SOCIAL MEDIA!</em></strong>
              <p>Help manage our social media accounts.</p>
            </li>

            <li>
              <strong><em>SUPPORT TEAM!</em></strong>
              <p>We have too many support requests to handle. Check out the <a href="https://meta.trustroots.org/t/wiki-support-team/22">meta thread</a> to get involved.</p>
            </li>

            <li>
              <strong><em>UI/UX & DESIGN!</em></strong>
              <p>Work out new features and improve existing flows. We love good looking design.</p>
            </li>

            <li>
              <strong><em>PHOTOGRAPHY!</em></strong>
              <p>Trustroots needs fresh photos every now and then. Would be great if you could <a href="https://github.com/Trustroots/trustroots/blob/master/docs/Photos.md">donate your travel photos</a>.</p>
            </li>

            <li>
              <strong><em>COPYWRITING!</em></strong>
              <p>Write stuff for our <a href="https://ideas.trustroots.org/">blog</a> or for the website.</p>
            </li>

            <li>
              <strong><em>PROOFREADING!</em></strong>
              <p>Find spelling errors and send us corrections by <a href="https://github.com/Trustroots/trustroots/issues/new">opening an issue</a>.</p>
            </li>

            <li>
              <strong><em>LEGAL!</em></strong>
              <p>We can really use help with legal issues.</p>
            </li>

            <li>
              <strong><em>DEVELOPMENT!</em></strong>
              <p>Want to be a <a href="https://github.com/Trustroots/trustroots/blob/master/docs/Development.md">Trustroots developer</a>? Jump right in. We have tons of <a href="https://github.com/Trustroots/trustroots/issues/">issues</a>... They even have labels (<a href="https://github.com/Trustroots/trustroots/labels/easy">easy</a>, <a href="https://github.com/Trustroots/trustroots/labels/Texts">texts</a>, <a href="https://github.com/Trustroots/trustroots/labels/help%20wanted">help wanted</a>).</p>
            </li>

            <li>
              <strong><em>TEST THE WEBSITE!</em></strong>
              <p>Use the website: travel and host! Test it out with different mobile devices, browsers, and screen sizes. Report bugs by opening <a href="https://github.com/Trustroots/trustroots/issues/new">an issue on GitHub</a> or use the <a ui-sref="contact">contact</a> form. </p>
            </li>

            <li>
              <strong><em>SPACE!</em></strong>
              <p>Let us know if you have a space at your disposal that you want to provide to a Trustroots collective or hackathon. (Check out some <a href="http://nomadwiki.org/en/Trustroots_Iberian_Collective_2018">previous</a> Trustroots spaces.)</p>
            </li>

            <li>
              <strong><em>SPREAD THE WORD!</em></strong>
              <p>Honestly, the biggest thing that helps us is helping more people find out about Trustroots.</p>
              <p>Tell your friends and fellow travelers about Trustroots, and tag us on social media. You can follow us on <a href="https://twitter.com/trustroots">Twitter</a>, <a href="https://www.instagram.com/trustroots_org/">Instagram</a>, <a href="https://www.facebook.com/trustroots.org/">Facebook</a>, and our <a href="https://ideas.trustroots.org/">blog</a>.</p>
              <p>If you write a post about Trustroots on your blog, definitely let us know so that we can share it.</p>
            </li>

            <li>
              <strong><em>GET IN TOUCH!</em></strong>
              <p>We&apos;re always happy to <a ui-sref="contact">hear from you</a> if you don&apos;t know what you can do.</p>
              <p>If you&apos;re still not sure and just want to chat to some humans, introduce yourself on our <a href="https://meta.trustroots.org/">volunteer forum</a>. All are welcome and we&apos;ll be happy to help you get started.</p>
            </li>

          </ul>

          <a className="btn btn-xs btn-primary pull-right" href="https://github.com/Trustroots/trustroots/edit/master/modules/pages/client/views/volunteering.client.view.html" rel="noopener noreferrer" target="_blank">Edit this page<i className="icon-github icon-lg"></i></a>

        </div>
      </div>
    </section>
  </>;
}

Volunteering.propTypes = {};
