import { expect } from 'chai';
import { spy } from 'sinon';
import { Component } from 'react';
import Router from '../src/Router';
import { createMemoryHistory } from 'history';
import { RouteNotFoundError } from '../src/errors';

describe('Router', () => {
    describe('#contructor()', () => {
        it('throws if routes are not an array', () => {
            [1, true, 1.0, Date()].forEach((routes) => {
                expect(
                    () => new Router(routes)
                ).to.throw(
                    `Invariant Violation: Routes should be an array, ${typeof routes} given.`
                );
            });
        });

        it('throws if onTransition is not an function or undefined', () => {
            [1, true, 1.0, Date()].forEach((callback) => {
                expect(
                    () => new Router([], createMemoryHistory(), callback)
                ).to.throw(
                    `Invariant Violation: Router onTransition callback should be a function, ${typeof callback} given.`
                );
            });
        });
    });

    describe('#run()', () => {
        it('resolves simple route with sync children and calls all callbacks', (done) => {
            let history;
            let called = false;

            const changeStart = spy();
            const changeSuccess = spy();

            const router = new Router(
                [
                    {
                        path: '/',
                        component: 'a',
                        children: () => Promise.resolve([{ path: 'test', component: 'b' }])
                    }
                ],
                history = createMemoryHistory(),
                () => {
                    if (called) return;

                    called = true;

                    router.run('/test').then(
                        (resolvedRoute) => {
                            try {
                                expect(resolvedRoute).to.be.an('object');
                                expect(resolvedRoute).to.have.property('pathname').and.be.equal('/test');
                                expect(resolvedRoute).to.have.property('components').and.be.deep.equal(['a', 'b']);
                                expect(resolvedRoute).to.have.property('vars').and.be.deep.equal({});
                                expect(resolvedRoute).to.have.property('query').and.be.deep.equal({});
                                expect(router.currentRoute()).to.be.an('object');
                                expect(history.replaceState.calledOnce).to.be.equal(true);
                                expect(changeStart.calledOnce).to.be.equal(true);

                                // this is called twice because first is initial load (location.listen)
                                expect(changeSuccess.calledTwice).to.be.equal(true);
                                done();
                            } catch (e) {
                                done(e);
                            }
                        },
                        done
                    );
                }
            );

            spy(history, 'listen');
            spy(history, 'replaceState');

            router.addChangeStartListener(changeStart);
            router.addChangeSuccessListener(changeSuccess);
            router.listen();
        });

        it('resolves route components asynchronously', (done) => {
            let history;
            let called = false;
            const changeStart = spy();
            const changeSuccess = spy();

            class App extends Component {}

            const router = new Router(
                [
                    {
                        path: '/',
                        component: App,
                        children: () => Promise.resolve([
                            {
                                path: 'test',
                                component: () => Promise.resolve(App)
                            }
                        ])
                    }
                ],
                history = createMemoryHistory(),
                () => {
                    if (called) return;

                    called = true;

                    router.run('/test').then(
                        (resolvedRoute) => {
                            try {
                                expect(resolvedRoute).to.be.an('object');
                                expect(resolvedRoute).to.have.property('pathname').and.be.equal('/test');
                                expect(resolvedRoute).to.have.property('components').and.be.deep.equal([App, App]);
                                expect(resolvedRoute).to.have.property('vars').and.be.deep.equal({});
                                expect(resolvedRoute).to.have.property('query').and.be.deep.equal({});
                                expect(router.currentRoute()).to.be.an('object');
                                expect(history.replaceState.calledOnce).to.be.equal(true);
                                expect(changeStart.calledOnce).to.be.equal(true);
                                expect(changeSuccess.calledTwice).to.be.equal(true);

                                done();
                            } catch (e) {
                                done(e);
                            }
                        }, done
                    );
                }
            );

            spy(history, 'listen');
            spy(history, 'replaceState');

            router.addChangeStartListener(changeStart);
            router.addChangeSuccessListener(changeSuccess);
            router.listen();
        });

        it('resolves a route with variables and calls all callbacks', (done) => {
            let history;
            let called = false;
            const changeStart = spy();
            const changeSuccess = spy();

            const router = new Router(
                [
                    {
                        path: '/',
                        component: 'a',
                        children: () => Promise.resolve([{ path: 'test/:variable', component: 'b' }])
                    }
                ],
                history = createMemoryHistory(),
                () => {
                    if (called) return;

                    called = true;

                    router.run('/test/10').then(
                        (resolvedRoute) => {
                            try {
                                expect(resolvedRoute).to.be.an('object');
                                expect(resolvedRoute).to.have.property('pathname').and.be.equal('/test/10');
                                expect(resolvedRoute).to.have.property('components').and.be.deep.equal(['a', 'b']);
                                expect(resolvedRoute).to.have.property('vars').and.be.deep.equal({
                                    variable: '10'
                                });
                                expect(resolvedRoute).to.have.property('query').and.be.deep.equal({});
                                expect(router.currentRoute()).to.be.an('object');
                                expect(history.replaceState.calledOnce).to.be.equal(true);
                                expect(changeStart.calledOnce).to.be.equal(true);
                                expect(changeSuccess.calledTwice).to.be.equal(true);

                                done();
                            } catch (e) {
                                done(e);
                            }
                        }, done
                    );
                }
            );

            spy(history, 'replaceState');

            router.addChangeStartListener(changeStart);
            router.addChangeSuccessListener(changeSuccess);
            router.listen();
        });

        it('rejects if route is not found and calls callbacks', (done) => {
            let called = false;
            const changeStart = spy();
            const changeFail = spy();
            const notFound = spy();
            let previousState;

            const router = new Router(
                [
                    {
                        path: '/',
                        component: 'a',
                        children: () => Promise.resolve([{ path: 'test/:variable{\\d+}', component: 'b' }])
                    }
                ],
                createMemoryHistory(),
                () => {
                    if (!called) {
                        previousState = router.currentRoute();
                    }

                    if (called) return;

                    called = true;

                    router.run('/test/abcd').catch(
                        (err) => {
                            try {
                                expect(changeStart.calledOnce).to.be.equal(false);
                                expect(changeFail.calledOnce).to.be.equal(false);
                                expect(notFound.calledOnce).to.be.equal(true);
                                expect(err).to.be.instanceof(RouteNotFoundError);
                                expect(router.currentRoute()).to.be.equal(previousState);

                                done();
                            } catch (e) {
                                done(e);
                            }
                        }
                    );
                }
            );

            router.addChangeStartListener(changeStart);
            router.addChangeFailListener(changeFail);
            router.addNotFoundListener(notFound);
            router.listen();
        });

        it('resolves simple route and calls replaceState on initial and pushState on subsequent', (done) => {
            let history;
            let called = false;
            const changeStart = spy();
            const changeSuccess = spy();

            const router = new Router(
                [
                    {
                        path: '/',
                        component: 'a',
                        children: () => Promise.resolve([
                            { path: '', component: 'b' },
                            { path: 'test', component: 'c' }
                        ])
                    }
                ],
                history = createMemoryHistory(),
                () => {
                    if (called) return;

                    called = true;

                    router.run('/').then(
                        (resolvedRoute) => {
                            try {
                                expect(resolvedRoute).to.be.an('object');
                                expect(resolvedRoute).to.have.property('pathname').and.be.equal('/');
                                expect(resolvedRoute).to.have.property('components').and.be.deep.equal(['a', 'b']);
                                expect(resolvedRoute).to.have.property('vars').and.be.deep.equal({});
                                expect(resolvedRoute).to.have.property('query').and.be.deep.equal({});
                                expect(router.currentRoute()).to.be.equal(resolvedRoute);

                                expect(history.replaceState.calledOnce).to.be.equal(true); // called on initial
                                expect(history.pushState.calledOnce).to.be.equal(true);
                                expect(changeStart.calledOnce).to.be.equal(true);
                                expect(changeSuccess.calledTwice).to.be.equal(true);

                                router.run('/test').then(
                                    (_resolvedRoute) => {
                                        try {
                                            expect(_resolvedRoute).to.be.an('object');
                                            expect(_resolvedRoute).to.have.property('pathname').and.be.equal('/test');
                                            expect(_resolvedRoute).to.have.property('components').and.be.deep.equal(['a', 'c']);
                                            expect(_resolvedRoute).to.have.property('vars').and.be.deep.equal({});
                                            expect(_resolvedRoute).to.have.property('query').and.be.deep.equal({});
                                            expect(router.currentRoute()).to.be.equal(_resolvedRoute);

                                            expect(history.replaceState.calledOnce).to.be.equal(true);
                                            expect(history.pushState.calledTwice).to.be.equal(true);
                                            expect(changeStart.calledTwice).to.be.equal(true);
                                            expect(changeSuccess.calledThrice).to.be.equal(true);

                                            done();
                                        } catch (e) {
                                            done(e);
                                        }
                                    }
                                );
                            } catch (e) {
                                done(e);
                            }
                        }
                    );
                }
            );


            spy(history, 'replaceState');
            spy(history, 'pushState');

            router.addChangeStartListener(changeStart);
            router.addChangeSuccessListener(changeSuccess);
            router.listen();
        });

        it('rejects not found route (and if has previous state, calls fail callback)', (done) => {
            let history;
            let called = false;
            const changeStart = spy();
            const changeSuccess = spy();
            const changeFail = spy();

            const router = new Router(
                [
                    {
                        path: '/',
                        component: 'a',
                        children: () => Promise.resolve([
                            { path: '', component: 'b' },
                            { path: 'test', component: 'c' }
                        ])
                    }
                ],
                history = createMemoryHistory(),
                () => {
                    if (called) return;

                    called = true;

                    router.run('/').then(
                        (resolvedRoute) => {
                            try {
                                expect(resolvedRoute).to.be.an('object');
                                expect(resolvedRoute).to.have.property('pathname').and.be.equal('/');
                                expect(resolvedRoute).to.have.property('components').and.be.deep.equal(['a', 'b']);
                                expect(resolvedRoute).to.have.property('vars').and.be.deep.equal({});
                                expect(router.currentRoute()).to.be.an('object');
                                expect(router.currentRoute()).to.have.property('pathname').and.be.equal('/');
                                expect(router.currentRoute()).to.have.property('components').and.be.deep.equal(['a', 'b']);
                                expect(router.currentRoute()).to.have.property('vars').and.be.deep.equal({});
                                expect(history.replaceState.calledOnce).to.be.equal(true);
                                expect(history.pushState.calledOnce).to.be.equal(true);
                                expect(changeStart.calledOnce).to.be.equal(true);
                                expect(changeSuccess.calledTwice).to.be.equal(true);
                                expect(changeFail.called).to.be.equal(false);

                                router.run('/lalala').catch(
                                    (err) => {
                                        try {
                                            expect(router.currentRoute()).to.be.deep.equal(resolvedRoute);
                                            expect(err).to.be.instanceof(RouteNotFoundError);

                                            // change listeners should not be called at alle
                                            // because they are called only if route matches
                                            expect(changeStart.calledOnce).to.be.equal(true);
                                            expect(changeFail.called).to.be.equal(false);
                                            expect(changeSuccess.calledTwice).to.be.equal(true);

                                            // we don't expect to change state of history
                                            // because we want user to do something about not found event
                                            expect(history.replaceState.calledOnce).to.be.equal(true);
                                            expect(history.pushState.calledOnce).to.be.equal(true);

                                            done();
                                        } catch (e) {
                                            done(e);
                                        }
                                    }
                                );
                            } catch (e) {
                                done(e);
                            }
                        }, done
                    );
                }
            );

            spy(history, 'replaceState');
            spy(history, 'pushState');

            router.addChangeStartListener(changeStart);
            router.addChangeSuccessListener(changeSuccess);
            router.addChangeFailListener(changeFail);
            router.listen();
        });
    });

    describe('route handler wrappers', () => {
        let router;
        let onAEnterSpy;
        let onBLeaveSpy;

        beforeEach(() => {
            router = new Router([
                { path: '/', component: 'A', onEnter: onAEnterSpy = spy() },
                { path: '/test', component: 'B', onLeave: onBLeaveSpy = spy() }
            ], createMemoryHistory());
            router.listen();
        });

        describe('#wrapOnEnterHandler', () => {
            it('wraps route onEnter handler with provided function', () => {
                const onEnterSpy = spy((onEnter) => {
                    return onEnter('a', 'b', 'c');
                });

                let previousState = router.currentRoute();

                router.wrapOnEnterHandler(onEnterSpy);

                return router.run('/', {}).then(
                    () => {
                        expect(onEnterSpy.calledOnce).to.be.equal(true);
                        expect(onAEnterSpy.calledOnce).to.be.equal(true);

                        const call = onAEnterSpy.getCall(0);
                        const [previous, current, _router, ...rest] = call.args;

                        expect(call.args).to.have.length(6);
                        expect(previous).to.be.equal(previousState); // previous route
                        expect(current).to.be.an('object').with.property('pathname').equal('/'); // current route
                        expect(_router).to.be.equal(router);
                        expect(rest).to.be.eql(['a', 'b', 'c']);
                    }
                );
            });
        });

        describe('#wrapOnLeaveHandler', () => {
            it('wraps route onEnter handler with provided function', () => {
                const onLeaveSpy = spy((onLeave) => {
                    return onLeave('a', 'b', 'c');
                });

                router.wrapOnLeaveHandler(onLeaveSpy);

                return router.run('/test', {}).then(
                    () => {
                        return router.run('/', {}).then(
                            () => {
                                expect(onLeaveSpy.calledTwice).to.be.equal(true);
                                expect(onBLeaveSpy.calledOnce).to.be.equal(true);

                                const call = onBLeaveSpy.getCall(0);
                                const [resolved, _router, ...rest] = call.args;

                                expect(call.args).to.have.length(5);
                                expect(resolved).to.be.an('object').with.property('pathname').equal('/'); // current route
                                expect(_router).to.be.equal(router);
                                expect(rest).to.be.eql(['a', 'b', 'c']);
                            }
                        );
                    }
                );
            });
        });
    });
});
