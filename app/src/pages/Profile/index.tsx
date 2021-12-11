import React,{useEffect, useState} from 'react'
import AboutMe from './AboutMe'
import Activate from './Activate'
import Avatar from './Avatar'
import BlockedMemberBanner from './BlockedMemberBanner'
import AvatarNameMobile from './AvatarNameMobile'
import {getUser} from '../../api/users/users.api'

interface Props {
    
}

const Profile = (props: Props) => {
  const [user, setUser] = useState(undefined);

  const fetchData = async () => {

    setUser(await getUser('fake-username'))

  }
  useEffect(() => {
    fetchData()
  }, [])

    return (
      <div className="col-md-6">
        {
          user && <AboutMe
          profile={user}
          isSelf={true}
          profileMinimumLength={5}
        />
        }
        { <Activate /> }
        { user && <Avatar user={user} size={512} link={false} /> }
        { user && <AvatarNameMobile profile={user}/> }
        { user && <BlockedMemberBanner username={user} /> }
    </div>
    )
}

export default Profile
