import React from 'react';
import { Document, Page, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { Edge, Node, Project, Tree, TreeKind } from '@prisma/client';
import type { ExportAudience } from './spec';

const TREE_LABEL: Record<TreeKind, string> = {
  DEV: 'Разработка',
  FUNC: 'Функции',
  BIZ: 'Бизнес',
};

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: 'Helvetica', lineHeight: 1.45 },
  title: { fontSize: 22, marginBottom: 8, fontWeight: 'bold' },
  subtitle: { fontSize: 12, color: '#555', marginBottom: 16 },
  section: { fontSize: 16, marginTop: 18, marginBottom: 8, fontWeight: 'bold' },
  heading: { fontSize: 13, marginTop: 10, marginBottom: 4, fontWeight: 'bold' },
  subheading: { fontSize: 11, marginTop: 6, marginBottom: 2, fontWeight: 'bold' },
  paragraph: { marginBottom: 6 },
  listItem: { marginLeft: 14, marginBottom: 3 },
  footer: { marginTop: 24, fontSize: 9, color: '#888' },
});

function walkNodes(
  parentId: string | null,
  nodes: Node[],
  depth: number,
  blocks: React.ReactNode[],
) {
  const children = nodes.filter((n) => n.parentId === parentId);
  for (const node of children) {
    const style = depth === 0 ? styles.heading : depth === 1 ? styles.subheading : styles.paragraph;
    blocks.push(
      <Text key={node.id} style={style}>
        {depth >= 2 ? '• ' : ''}
        {node.title}
      </Text>,
    );
    if (node.description) {
      blocks.push(
        <Text key={`${node.id}-desc`} style={styles.paragraph}>
          {node.description}
        </Text>,
      );
    }
    walkNodes(node.id, nodes, depth + 1, blocks);
  }
}

function SpecPdfDocument({
  project,
  trees,
  nodes,
  audience,
}: {
  project: Project;
  trees: Tree[];
  nodes: Node[];
  audience: ExportAudience;
}) {
  const sections: React.ReactNode[] = [];

  for (const tree of trees) {
    const treeNodes = nodes.filter((n) => n.treeId === tree.id);
    if (!treeNodes.length) continue;
    sections.push(
      <Text key={tree.id} style={styles.section}>
        {TREE_LABEL[tree.kind]}
      </Text>,
    );
    const blocks: React.ReactNode[] = [];
    walkNodes(tree.rootId, treeNodes, 0, blocks);
    if (!tree.rootId) walkNodes(null, treeNodes, 0, blocks);
    sections.push(...blocks);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          {project.emoji ? `${project.emoji} ` : ''}
          {project.name}
        </Text>
        {project.description ? (
          <Text style={styles.subtitle}>{project.description}</Text>
        ) : null}
        {audience === 'ai' ? (
          <Text style={styles.paragraph}>
            Техническое задание для исполнения ИИ-агентом (объединённые деревья).
          </Text>
        ) : null}
        {sections}
        <Text style={styles.footer}>
          Сгенерировано Sai · {new Date().toLocaleString('ru-RU')}
        </Text>
      </Page>
    </Document>
  );
}

export async function exportPdf(
  project: Project,
  trees: Tree[],
  nodes: Node[],
  audience: ExportAudience = 'human',
  _edges: Edge[] = [],
): Promise<Buffer> {
  const doc = (
    <SpecPdfDocument project={project} trees={trees} nodes={nodes} audience={audience} />
  );
  const buf = await renderToBuffer(doc);
  return Buffer.from(buf);
}
