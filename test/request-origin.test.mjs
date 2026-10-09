import {test} from 'node:test';import assert from 'node:assert/strict';
import {allowedOrigin} from '../request-origin.mjs';
test('same-host HTTP and HTTPS work while other hosts remain rejected',()=>{
 assert.ok(allowedOrigin('http://localhost:3000','localhost:3000'));
 assert.ok(allowedOrigin('https://fonts.example.com','fonts.example.com'));
 assert.ok(allowedOrigin(undefined,'localhost:3000'));
 for(const origin of ['https://other.example.com','null','https://fonts.example.com/path','ftp://fonts.example.com'])assert.equal(allowedOrigin(origin,'fonts.example.com'),false);
});
