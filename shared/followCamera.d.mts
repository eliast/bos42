export type FollowCamera={lon:number;lat:number;bearing:number;zoom:number;pitch:number;elevation:number};
export function smoothFollowCamera(current:FollowCamera,target:FollowCamera,elapsedMs:number):FollowCamera;
