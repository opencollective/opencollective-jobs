// 'use strict';
//
// describe.skip('lib:github:contributions', () => {
//   let sandbox;
//   let client;
//   let repos;
//   let results;
//
//   beforeEach(() => {
//     sandbox = sinon.sandbox.create('lib:github:contributions');
//     repos = [
//       {
//         name: 'foo'
//       },
//       {
//         name: 'bar'
//       }
//     ];
//     client = {
//       repos: {
//         getForOrgAsync: sandbox.stub()
//           .returns(Promise.resolve(repos)),
//         getContributorsAsync: sandbox.stub()
//           .returns(Promise.resolve([
//             {
//               login: 'boneskull',
//               contributions: 42
//             },
//             {
//               login: 'xdamman',
//               contributions: 55
//             }
//           ]))
//       }
//     };
//     results = {
//       quux: {
//         foo: {
//           boneskull: 42,
//           xdamman: 55
//         },
//         bar: {
//           boneskull: 42,
//           xdamman: 55
//         }
//       }
//     };
//   });
//
//   it('should call the "getForOrg" method', () => {
//     return contributions(client, {orgs: ['quux']})
//       .then(() => {
//         expect(client.repos.getForOrgAsync)
//           .to
//           .have
//           .been
//           .calledWithExactly({
//             org: 'quux',
//             type: 'public'
//           });
//       });
//   });
//
//   it('should return aggregated results', () => {
//     return expect(contributions(client, {orgs: ['quux']}))
//       .to
//       .eventually
//       .eql(results);
//   });
//
//   it('should allow a custom "org" property', () => {
//     return contributions(client, {orgs: ['quux']})
//       .then(() => {
//         expect(client.repos.getForOrgAsync)
//           .to
//           .have
//           .been
//           .calledWithExactly({
//             org: 'quux',
//             type: 'public'
//           });
//       });
//   });
//
//   describe('when curried', () => {
//     let curried;
//
//     beforeEach(() => {
//       curried = contributions(client);
//     });
//
//     it('should call the "getForOrg" method', () => {
//       return curried({orgs: ['quux']})
//         .then(() => {
//           expect(client.repos.getForOrgAsync)
//             .to
//             .have
//             .been
//             .calledWithExactly({
//               org: 'quux',
//               type: 'public'
//             });
//         });
//     });
//
//     it('should return the value returned by the "getForOrg" method', () => {
//       return expect(curried({orgs: ['quux']}))
//         .to
//         .eventually
//         .eql(results);
//     });
//   });
//
//   afterEach(() => {
//     sandbox.restore();
//   });
// });
