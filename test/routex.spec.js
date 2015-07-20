import { createStore, combineReducers, compose } from 'redux';
import { createRoutex, actions } from '../src';
import { spy } from 'sinon';
import { expect } from 'chai';
import { createMemoryHistory } from 'history';

const transitionTo = actions.transitionTo;

describe('routex', () => {
    function createRoutexStore(_history, onTransition, initialState) {
        const routex = createRoutex(
            [
                { path: '/', component: 'A' },
                { path: '/child', component: 'Child' },
                { path: '/rejected-on-enter', onEnter: () => Promise.reject(), component: 'RejectedOnEnter' },
                { path: '/rejected-on-leave', onLeave: () => Promise.reject(), component: 'RejectedOnLeave' },
                { path: '/with-variables/:user/:id{\\d+}', component: 'WithVariables' }
            ],
            _history,
            onTransition
        );

        return compose(routex.store, createStore)(combineReducers(routex.reducer), initialState);
    }

    function stripRouteInfo(route) {
        const { pathname, query, vars, components } = route;

        return {
            pathname,
            query,
            vars,
            components
        };
    }

    it('replaces state in history on initial load if router state is initial', (done) => {
        let store;
        let history = createMemoryHistory();
        spy(history, 'listen');
        spy(history, 'replaceState');

        let onTransition = spy(() => {
            try {
                expect(onTransition.called).to.be.equal(true);
                expect(history.listen.called).to.be.equal(true);
                expect(history.replaceState.called).to.be.equal(true);
                expect(store.getState().router.state).to.be.equal('TRANSITIONED');
                expect(stripRouteInfo(store.getState().router.route)).to.be.deep.equal({
                    pathname: '/',
                    query: {},
                    vars: {},
                    components: ['A']
                });

                done();
            } catch (e) {
                done(e);
            }
        });
        store = createRoutexStore(history, onTransition);
    });

    it('replaces state in history on initial load if current state is null (in browser after load)', (done) => {
        let store;
        let history = createMemoryHistory();
        spy(history, 'listen');
        spy(history, 'replaceState');

        let onTransition = spy(() => {
            try {
                expect(onTransition.called).to.be.equal(true);
                expect(history.listen.called).to.be.equal(true);
                expect(history.replaceState.called).to.be.equal(true);
                expect(store.getState().router.state).to.be.equal('TRANSITIONED');
                expect(stripRouteInfo(store.getState().router.route)).to.be.deep.equal({
                    pathname: '/',
                    query: {},
                    vars: {},
                    components: ['A']
                });

                done();
            } catch (e) {
                done(e);
            }
        });

        store = createRoutexStore(history, onTransition, {
            router: {
                state: 'TRANSITIONED',
                route: {
                    pathname: '/',
                    query: {},
                    vars: {}
                }
            }
        });
    });

    it('pushes state to history on successful transition (from known state to another)', (done) => {
        let store;
        let history = createMemoryHistory();
        spy(history, 'listen');
        spy(history, 'pushState');
        let onTransition = spy();

        store = createRoutexStore(history, onTransition, {
            router: {
                state: 'TRANSITIONED',
                route: {
                    pathname: '/',
                    query: {},
                    vars: {}
                }
            }
        });

        setTimeout(() => {
            expect(store.getState().router.state).to.be.equal('TRANSITIONED');
            expect(stripRouteInfo(store.getState().router.route)).to.be.deep.equal({
                pathname: '/',
                query: {},
                vars: {},
                components: ['A']
            });

            store.dispatch(transitionTo('/child', {}));

            setTimeout(() => {
                expect(history.listen.called).to.be.equal(true);
                expect(onTransition.calledTwice).to.be.equal(true);
                expect(history.pushState.called).to.be.equal(true);
                expect(stripRouteInfo(store.getState().router.route)).to.deep.equal({
                    pathname: '/child',
                    query: {},
                    vars: {},
                    components: ['Child']
                });

                done();
            }, 0);
        }, 0);
    });

    it('changes state using change success action if pop state event is emitted', (done) => {
        let store;
        let history = createMemoryHistory(['/']);
        spy(history, 'listen');
        spy(history, 'pushState');

        const childState = {
            pathname: '/child',
            query: {},
            vars: {},
            components: ['Child']
        };

        const indexState = {
            pathname: '/',
            query: {},
            vars: {},
            components: ['A']
        };

        let steps = [
            () => {
                expect(store.getState().router.state).to.be.equal('TRANSITIONED');
                expect(stripRouteInfo(store.getState().router.route)).to.deep.equal(indexState);

                store.dispatch(transitionTo('/child', {}));
            },
            () => {
                expect(history.pushState.calledOnce).to.be.equal(true);
                expect(store.getState().router.state).to.be.equal('TRANSITIONED');
                expect(stripRouteInfo(store.getState().router.route)).to.deep.equal(childState);

                // call on pop state with state from history and return back
                // this dispatches ROUTE_CHANGE_SUCCESS immediately
                history.goBack();
            },
            () => {
                expect(store.getState().router.state).to.be.equal('TRANSITIONED');
                expect(stripRouteInfo(store.getState().router.route)).to.deep.equal(indexState);

                // go forward
                history.goForward();
            },
            () => {
                expect(store.getState().router.state).to.be.equal('TRANSITIONED');
                expect(stripRouteInfo(store.getState().router.route)).to.deep.equal(childState);
                done();
            }
        ];

        let onTransition = () => {
            try {
                steps.shift().apply(this, arguments);
            } catch (e) {
                done(e);
            }
        };

        store = createRoutexStore(history, onTransition, {
            router: {
                state: 'TRANSITIONED',
                route: {
                    pathname: '/',
                    query: {},
                    vars: {}
                }
            }
        });
    });

    it('cancels transition if one of onEnter handlers rejects', (done) => {
        const indexState = {
            pathname: '/',
            query: {},
            vars: {},
            components: ['A']
        };

        let onTransition = spy();

        const store = createRoutexStore(createMemoryHistory(), onTransition, {
            router: {
                state: 'TRANSITIONED',
                route: {
                    pathname: '/',
                    query: {},
                    vars: {}
                }
            }
        });

        setTimeout(() => {
            expect(store.getState().router.state).to.be.equal('TRANSITIONED');
            expect(stripRouteInfo(store.getState().router.route)).to.deep.equal(indexState);

            store.dispatch(transitionTo('/rejected-on-enter', {}));

            setTimeout(() => {
                expect(store.getState().router.state).to.be.equal('TRANSITIONED');
                expect(store.getState().router.error).to.be.eql(Error('onEnter handlers on route rejected-on-enter are not resolved.'));
                expect(stripRouteInfo(store.getState().router.route)).to.deep.equal(indexState);

                done();
            }, 0);
        }, 0);
    });

    it('cancels transition if one of onLeave handlers rejects', (done) => {
        const indexState = {
            pathname: '/rejected-on-leave',
            query: {},
            vars: {},
            components: ['RejectedOnLeave']
        };

        let onTransition = spy();

        const store = createRoutexStore(createMemoryHistory(['/rejected-on-leave']), onTransition, {
            router: {
                state: 'TRANSITIONED',
                route: {
                    pathname: '/rejected-on-leave',
                    query: {},
                    vars: {}
                }
            }
        });

        setTimeout(() => {
            expect(store.getState().router.state).to.be.equal('TRANSITIONED');
            expect(stripRouteInfo(store.getState().router.route)).to.deep.equal(indexState);

            store.dispatch(transitionTo('/', {}));

            setTimeout(() => {
                expect(store.getState().router.state).to.be.equal('TRANSITIONED');
                expect(store.getState().router.error).to.be.eql(Error('onLeave handlers on route rejected-on-leave are not resolved.'));
                expect(stripRouteInfo(store.getState().router.route)).to.deep.equal(indexState);

                done();
            }, 0);
        }, 0);
    });
});
