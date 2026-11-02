/* MOCK LAB DATA ONLY. Never import this file into production. */
window.HUB_LAB_INVENTORY=[
 {id:'L2-D001',short:'D001',name:'Arched Window 1',kind:'hot_desk',x:5.2,y:4.5,rot:-9,capacity:1,status:'available',price:40,unit:'day',amenities:['Daylight','Monitor arm','Fast Wi-Fi']},
 {id:'L2-D002',short:'D002',name:'Arched Window 2',kind:'hot_desk',x:7.2,y:5.4,rot:-9,capacity:1,status:'selected',price:40,unit:'day',amenities:['Daylight','Power','Fast Wi-Fi']},
 {id:'L2-D003',short:'D003',name:'Column Bay 1',kind:'dedicated_desk',x:9.3,y:7.1,rot:9,capacity:1,status:'available',price:395,unit:'month',amenities:['24/7 access','Storage','Member events']},
 {id:'L2-D004',short:'D004',name:'Clock Desk 1',kind:'dedicated_desk',x:12.0,y:8.1,rot:9,capacity:1,status:'occupied',price:395,unit:'month',amenities:['24/7 access','Storage','Fast Wi-Fi']},
 {id:'L2-D005',short:'D005',name:'Acoustic Wall 1',kind:'hot_desk',x:14.2,y:10.1,rot:-9,capacity:1,status:'held',price:40,unit:'day',amenities:['Quiet zone','Power','Fast Wi-Fi']},
 {id:'L2-D006',short:'D006',name:'Neckinger Desk',kind:'dedicated_desk',x:17.2,y:11.1,rot:9,capacity:1,status:'yours',price:395,unit:'month',amenities:['24/7 access','Storage','Your current desk']},
 {id:'L2-MR01',short:'MR01',name:'The Wharf Room',kind:'meeting_room',x:21.2,y:5.0,rot:-9,capacity:8,status:'available',price:55,unit:'hour',amenities:['55-inch display','Video calls','Whiteboard']},
 {id:'L2-MR02',short:'MR02',name:'The Neckinger Room',kind:'meeting_room',x:24.0,y:7.2,rot:-9,capacity:4,status:'occupied',price:38,unit:'hour',amenities:['Display','Video calls','Natural light']},
 {id:'L2-OFFICE03',short:'OFF03',name:'Private Office 03',kind:'private_office',x:26.6,y:10.6,rot:-9,capacity:6,status:'available',price:null,unit:'enquire',amenities:['Six desks','Natural light','Meeting-room credits']},
 {id:'L2-EVENT01',short:'EVENT',name:'The Long Floor',kind:'event_space',x:19.2,y:14.2,rot:9,capacity:55,status:'available',price:null,unit:'enquire',amenities:['Flexible layout','Presentation setup','Catering options']}
];
window.HUB_LAB={
 labelKind:k=>({hot_desk:'Hot desk / day pass',dedicated_desk:'Dedicated desk',meeting_room:'Meeting room',private_office:'Private office',event_space:'Event space'}[k]||k),
 money:(amount,unit)=>amount==null?'Enquire':`£${amount} / ${unit}`,
 saveSelection:item=>localStorage.setItem('hub-lab-selection',JSON.stringify(item)),
 getSelection:()=>{try{return JSON.parse(localStorage.getItem('hub-lab-selection'))}catch{return null}},
 saveBooking:data=>localStorage.setItem('hub-lab-booking',JSON.stringify(data)),
 getBooking:()=>{try{return JSON.parse(localStorage.getItem('hub-lab-booking'))}catch{return null}}
};
