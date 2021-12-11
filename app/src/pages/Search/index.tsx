import { FC } from 'react'
import Map from './Map'



const Search:FC = () => {

    return (
        <>
        <div> I am alive! </div>
        <Map onOfferClose={() => {}} onOfferOpen={() => {}} filters={''} isUserPublic={true} location={undefined} locationBounds={undefined}/>
        </>
    );
}



export default Search