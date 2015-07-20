import ExecutionEnvironment from 'react/lib/ExecutionEnvironment';
import jsdom from 'mocha-jsdom';
import { expect } from 'chai';
import { createStore, compose, combineReducers } from 'redux';
import { createRoutex, actions } from '../../src';
import { createMemoryHistory } from 'history';
import React, { Component, addons } from 'react/addons';
import { Provider } from 'react-redux';
import { View } from '../../src/react';

const utils = addons.TestUtils;

describe('View', () => {
    // let utils, React, Provider, Component, View;

    function createRoutexStore(routes, initialState, onTransition) {
        const routex = createRoutex(routes, createMemoryHistory(), onTransition);

        return compose(routex.store, createStore)(combineReducers(routex.reducer), initialState);
    }

    jsdom({ url: 'http://localhost/' });

    beforeEach(() => {
        // reset window history state
        window.history.replaceState(null, null, '/');

        ExecutionEnvironment.canUseDOM = true;
    });

    it('renders matched route on initial load when state is not provided (default state)', (done) => {
        class App extends Component {
            render() {
                return <div>{this.props.children || 'Pom'}</div>;
            }
        }

        const store = createRoutexStore(
            [
                {
                    path: '/',
                    component: App
                }
            ],
            undefined,
            (err) => {
                if (err) done(err);

                const tree = utils.renderIntoDocument(
                    <Provider store={store}>
                        {() => <View />}
                    </Provider>
                );

                utils.findRenderedComponentWithType(tree, App);
                done();
            });
    });

    it('renders matched route on initial load (rehydrated)', (done) => {
        class App extends Component {
            render() {
                return <div>{this.props.children || 'Pom'}</div>;
            }
        }

        const store = createRoutexStore(
            [
                {
                    path: '/',
                    component: App
                }
            ],
            {
                router: { state: 'TRANSITIONED', route: { pathname: '/', query: {}, vars: {} }}
            },
            (err) => {
                if (err) done(err);

                const tree = utils.renderIntoDocument(
                    <Provider store={store}>
                        {() => <View />}
                    </Provider>
                );

                utils.findRenderedComponentWithType(tree, App);
                done();
            }
        );
    });

    it('renders route components on successful transition', (done) => {
        class App extends Component {
            render() {
                return <div>{this.props.children || 'Pom'}</div>;
            }
        }

        class Child extends Component {
            render() {
                return <span>pom</span>;
            }
        }

        const store = createRoutexStore(
            [
                {
                    path: '/',
                    component: App,
                    children: [
                        {
                            path: '/child',
                            component: Child
                        }
                    ]
                }
            ],
            {
                router: { state: 'TRANSITIONED', route: { pathname: '/', query: {}, vars: {} }}
            }
        );

        setTimeout(() => {
            const tree = utils.renderIntoDocument(
                <Provider store={store}>
                    {() => <View />}
                </Provider>
            );

            utils.findRenderedComponentWithType(tree, App);
            store.dispatch(actions.transitionTo('/child'));

            setTimeout(
                () => {
                    expect(store.getState().router.route.pathname).to.be.equal('/child');
                    utils.findRenderedComponentWithType(tree, App);
                    utils.findRenderedComponentWithType(tree, Child);

                    done();
                }, 0
            );
        }, 0);
    });
});
