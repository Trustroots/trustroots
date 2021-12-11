import React,{useEffect, useState} from 'react'
import AboutMe from './AboutMe'
import Activate from './Activate'
import Avatar from './Avatar'
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
    </div>
    )
}

export default Profile
