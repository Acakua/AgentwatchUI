const {evaluate}=require(process.argv[2]);
const T=[["1+2*3",7],["-2^2",-4],["2^-2",0.25],["2^3^2",512],["--3",3],["2*-+-3",6],["-7 % 3",2],["7 % -3",-2],["2(3+4)",14],["(1+2)(3+4)",21],[".5+1e3",1000.5],["2.5E-2*4",0.1],["min(3, 1, 2)",1],["MAX(1,max(2,3))",3],["abs(-4.5)",4.5],["-abs(-2)^2",-4],["10/4",2.5],["  ( ( 2 ) ) ",2],["2^-abs(1)",0.5],["min(5)",5],["3-(-2)(2)",7]];
const E=[["1/0","DIV0"],["5%0","DIV0"],["","SYNTAX"],["2 3","SYNTAX"],["(1+2","SYNTAX"],["1+","SYNTAX"],["foo(1)","SYNTAX"],["abs(1,2)","SYNTAX"],["2$3","SYNTAX"],["1+2)","SYNTAX"],["min()","SYNTAX"],["2(3)4","SYNTAX"],["1e","SYNTAX"]];
let p=0,f=[];
for(const [e,v] of T){try{const r=evaluate(e);if(Math.abs(r-v)<1e-9)p++;else f.push(`${e}=>${r}`)}catch(x){f.push(`${e}!${x.message}`)}}
for(const [e,m] of E){try{const r=evaluate(e);f.push(`${e}=>${r}`)}catch(x){if(x.message===m)p++;else f.push(`${e}!${x.message}`)}}
console.log(`${p}/${T.length+E.length}`,f.join(' | '));
