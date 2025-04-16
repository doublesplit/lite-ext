import { type ContainerNode, type VNode, Component, render } from 'preact';

/** Redirect rendering of descendants into the given CSS selector.
 *  @example
 *    <Portal into="body">
 *      <div>I am rendered into document.body</div>
 *    </Portal>
 */
type PortalProps = {
    into: string | HTMLElement;
    children: VNode | VNode[];
};
export default class Portal extends Component<PortalProps> {
    isMounted = false;
    into: HTMLElement;
    remote: Element;
    intoPointer: string | HTMLElement;
    declare $state: any;
    componentDidUpdate(props) {
        for (const i in props) {
            if (props[i] !== this.props[i]) {
                return setTimeout(() => this.renderLayer());
            }
        }
    }

    componentDidMount() {
        this.isMounted = true;
        this.renderLayer = this.renderLayer.bind(this);
        this.renderLayer();
    }

    componentWillUnmount() {
        this.renderLayer(false);
        this.isMounted = false;
        if (this.remote && this.remote.parentNode) this.remote.parentNode.removeChild(this.remote);
    }

    findNode(node) {
        return typeof node === 'string' ? document.querySelector(node) : node;
    }

    renderLayer(show = true) {
        if (!this.isMounted) return;

        // clean up old node if moving bases:
        if (this.props.into !== this.intoPointer) {
            this.intoPointer = this.props.into;
            if (this.into && this.remote) {
                // @ts-ignore
                this.remote = render(<PortalProxy />, createRootFragment(this.into, this.remote));
            }
            this.into = this.findNode(this.props.into);
        }

        // @ts-ignore
        this.remote = render(
            <PortalProxy context={this.$state}>{show && this.props.children ? [this.props.children] : null}</PortalProxy>,
            createRootFragment(this.into, this.remote)
        );
    }

    render() {
        return null;
    }
}

// high-order component that renders its first child if it exists.
// used as a conditional rendering proxy.
type PortalProxyProps = {
    context: any;
};
class PortalProxy extends Component<PortalProxyProps> {
    getChildContext() {
        return this.props.context;
    }
    render({ children } = this.props) {
        return (children && children[0]) || null;
    }
}

/**
 * A Preact 11+ implementation of the `replaceNode` parameter from Preact 10.
 *
 * This creates a "Persistent Fragment" (a fake DOM element) containing one or more
 * DOM nodes, which can then be passed as the `parent` argument to Preact's `render()` method.
 */
export function createRootFragment(parent: Node, replaceNode?: Node | Node[]): ContainerNode {
    if (replaceNode) {
        replaceNode = Array.isArray(replaceNode) ? replaceNode : [replaceNode];
    } else {
        replaceNode = [parent];
        parent = parent.parentNode as Node;
    }

    const s: Node | null = replaceNode[replaceNode.length - 1].nextSibling;

    const rootFragment: Partial<ContainerNode> = {
        nodeType: 1,
        parentNode: parent as ParentNode,
        firstChild: replaceNode[0] as ChildNode,
        childNodes: replaceNode,
        insertBefore: (c: Node, r: Node) => {
            parent.insertBefore(c, r || s);
            return c;
        },
        appendChild: (c: Node) => {
            parent.insertBefore(c, s);
            return c;
        },
        removeChild: function (c: Node) {
            parent.removeChild(c);
            return c;
        }
    };

    (parent as any).__k = rootFragment;
    return rootFragment as ContainerNode;
}
