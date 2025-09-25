'use strict';

// randomly choosing an integer between min and max 
function rand(max, min = 0) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * 正規分布乱数関数 参考:http://d.hatena.ne.jp/iroiro123/20111210/1323515616
 * @param number m: mean μ
 * @param number sigma: variance = σ^2
 * @return number ランダムに生成された値
 * Box-Muller Method
 */
function BoxMuller(m, sigma) {
    let a = 1 - Math.random();
    let b = 1 - Math.random();
    let c = Math.sqrt(-2 * Math.log(a));
    if(0.5 - Math.random() > 0) {
        return c * Math.sin(Math.PI * 2 * b) * sigma + m;
    }else{
        return c * Math.cos(Math.PI * 2 * b) * sigma + m;
    }
};

function BoxMuller_positive(m, sigma, max) {
    let a = 1 - Math.random();
    let b = 1 - Math.random();
    let c = Math.sqrt(-2 * Math.log(a));
    let e;
    if(0.5 - Math.random() > 0) {
        e = Math.abs( c * Math.sin(Math.PI * 2 * b) * sigma + m );
    }else{
        e = Math.abs( c * Math.cos(Math.PI * 2 * b) * sigma + m );
    }
    if (e < max) {
        return e;
    } else {
        return max;
    }
};

// Sum of all elements of the array
function sum (arr, fn) {  
    if (fn) {
        return sum(arr.map(fn));
    }
    else {
        return arr.reduce(function(prev, current, i, arr) {
                return prev+current;
        });
    }
};

function repeatelem (elem, n) {
    // returns an array with element elem repeated n times.
    let arr = [];

    for (let i = 0; i < n; i++) {
        arr = arr.concat(elem);
    };
    return arr;
};

