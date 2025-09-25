'use strict';

window.onload = function() {
    if (window.performance) {
                if (performance.navigation.type === 1) {
                // リロードされた
                } else {
                // リロードされていない
                }
            }
}
