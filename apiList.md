# DevTinder API's

## authRouter
- POST /signup -> done
- POST /login  -> done
- POST /logout -> done

## profileRouter
- GET /profile/view -> done
- GET /profile/edit -> done
- GET /profile/password

## connectionRequestRouter
- POST /request/send/:status/:toUserId -> done

- POST /request/review/:status/:requestId -> done

## userRouter
- GET /user/connections
- GET /user/requests/recieved
- GET /user/feed - Gets you the profile of other users on the platform

status : ignored, interested, accepted, rejected