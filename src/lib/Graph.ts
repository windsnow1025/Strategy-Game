export interface NodeData {
  canRecruit: boolean;
  income: number;
}

class Graph {
  nodes: Map<string, { connections: Set<string>, data: NodeData }>;

  constructor() {
    this.nodes = new Map();
  }

  addNode(node: string, data: NodeData) {
    if (!this.nodes.has(node)) {
      this.nodes.set(node, {connections: new Set(), data: data});
    }
  }

  getNodeData(node: string): NodeData | undefined {
    return this.nodes.get(node)?.data;
  }

  getNeighborCount(node: string): number {
    return this.nodes.get(node)!.connections.size;
  }

  addEdge(node1: string, node2: string) {
    if (!this.nodes.has(node1) || !this.nodes.has(node2)) {
      return;
    }
    this.nodes.get(node1)!.connections.add(node2);
    this.nodes.get(node2)!.connections.add(node1);
  }

  toJSON(): GraphJSON {
    const nodes: GraphNodeJSON[] = [];
    const edges: [string, string][] = [];
    const visited = new Set<string>();
    for (const [name, {connections, data}] of this.nodes) {
      nodes.push({name, data: {...data}});
      for (const neighbor of connections) {
        const key = [name, neighbor].sort().join("|");
        if (!visited.has(key)) {
          visited.add(key);
          edges.push([name, neighbor]);
        }
      }
    }
    return {nodes, edges};
  }

  static fromJSON(json: GraphJSON): Graph {
    const graph = new Graph();
    for (const {name, data} of json.nodes) {
      graph.addNode(name, {...data});
    }
    for (const [a, b] of json.edges) {
      graph.addEdge(a, b);
    }
    return graph;
  }

  getDistance(node1: string, node2: string, blockedNodes?: Set<string>) {
    if (node1 === node2) return 0;
    const visited = new Set<string>();
    const queue: [string, number][] = [[node1, 0]];
    let head = 0;

    while (head < queue.length) {
      const [currentNode, currentDistance] = queue[head++];

      if (currentNode === node2) {
        return currentDistance;
      }

      visited.add(currentNode);
      const neighbors = this.nodes.get(currentNode)?.connections;

      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && !blockedNodes?.has(neighbor)) {
            queue.push([neighbor, currentDistance + 1]);
            visited.add(neighbor);
          }
        }
      }
    }

    return Infinity;
  }
}

export interface GraphNodeJSON {
  name: string;
  data: NodeData;
}

export interface GraphJSON {
  nodes: GraphNodeJSON[];
  edges: [string, string][];
}

export default Graph;
