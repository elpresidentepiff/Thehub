/* MOCK LAB DATA ONLY. Never import this file into production.
   Positions come from data/inventory/unit4-l2.json (real Rev B geometry). Names, statuses
   and prices are invented for the lab. */
window.HUB_LAB_INVENTORY=[
 {id:'L2-D001',short:'D001',name:'Arched Window 1',kind:'hot_desk',x:12.599,y:4.679,rot:81.0,capacity:1,status:'available',price:35,unit:'day',amenities:['Daylight','Monitor arm','Fast Wi-Fi']},
 {id:'L2-D002',short:'D002',name:'Arched Window 2',kind:'hot_desk',x:13.265,y:4.574,rot:81.0,capacity:1,status:'selected',price:35,unit:'day',amenities:['Daylight','Power','Fast Wi-Fi']},
 {id:'L2-D003',short:'D003',name:'Column Bay 1',kind:'dedicated_desk',x:15.677,y:4.191,rot:81.0,capacity:1,status:'available',price:395,unit:'month',amenities:['24/7 access','Storage','Member events']},
 {id:'L2-D004',short:'D004',name:'Clock Desk 1',kind:'dedicated_desk',x:16.343,y:4.085,rot:81.0,capacity:1,status:'occupied',price:395,unit:'month',amenities:['24/7 access','Storage','Fast Wi-Fi']},
 {id:'L2-D005',short:'D005',name:'Acoustic Wall 1',kind:'hot_desk',x:18.755,y:3.703,rot:81.0,capacity:1,status:'held',price:35,unit:'day',amenities:['Quiet zone','Power','Fast Wi-Fi']},
 {id:'L2-D006',short:'D006',name:'Neckinger Desk',kind:'dedicated_desk',x:19.421,y:3.597,rot:81.0,capacity:1,status:'yours',price:395,unit:'month',amenities:['24/7 access','Storage','Your current desk']},
 {id:'L2-MR01',short:'MR01',name:'The Wharf Room',kind:'meeting_room',x:9.0,y:7.3,rot:-9.0,capacity:4,status:'available',price:55,unit:'hour',amenities:['55-inch display','Video calls','Whiteboard']},
 {id:'L2-MR02',short:'MR02',name:'The Neckinger Room',kind:'meeting_room',x:19.1,y:12.55,rot:-9.0,capacity:8,status:'occupied',price:38,unit:'hour',amenities:['Display','Video calls','Natural light']},
 {id:'L2-OFFICE01',short:'OFF01',name:'Private Office 01',kind:'private_office',x:27.4,y:3.8,rot:-9.0,capacity:6,status:'available',price:null,unit:'enquire',amenities:['Six desks','Natural light','Meeting-room credits']}
];
window.HUB_LAB={
 labelKind:k=>({hot_desk:'Hot desk / day pass',dedicated_desk:'Dedicated desk',meeting_room:'Meeting room',private_office:'Private office',event_space:'Event space'}[k]||k),
 money:(amount,unit)=>amount==null?'Enquire':`£${amount} / ${unit}`,
 saveSelection:item=>localStorage.setItem('hub-lab-selection',JSON.stringify(item)),
 getSelection:()=>{try{return JSON.parse(localStorage.getItem('hub-lab-selection'))}catch{return null}},
 saveBooking:data=>localStorage.setItem('hub-lab-booking',JSON.stringify(data)),
 getBooking:()=>{try{return JSON.parse(localStorage.getItem('hub-lab-booking'))}catch{return null}}
};
