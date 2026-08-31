import { supabase } from '@/integrations/supabase/client';

export interface PromobData {
  projectName: string;
  customerName: string;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  items: Array<{ name: string; type: string }>;
  imageUrl: string;
  simulationUrl?: string;
  ambiente?: string;
}

export async function saveStudioMeasurement(data: PromobData) {
  const { error } = await supabase.from('studio_measurements').insert({
    client_name: data.customerName,
    ambiente: data.ambiente,
    dimensions: data.dimensions,
    items: data.items,
    image_url: data.imageUrl,
    simulation_url: data.simulationUrl,
    status: 'pending_promob'
  });
  
  if (error) throw error;
}

export function generatePromobXML(data: PromobData): string {
  const date = new Date().toISOString();
  
  return `<?xml version="1.0" encoding="utf-8"?>
<PromobProject version="1.0">
  <Header>
    <ProjectName>${data.projectName}</ProjectName>
    <CustomerName>${data.customerName}</CustomerName>
    <CreationDate>${date}</CreationDate>
    <SourceApp>Lumina Designer Pro AR</SourceApp>
  </Header>
  <Environment>
    <Dimensions>
      <Width>${data.dimensions.width}</Width>
      <Height>${data.dimensions.height}</Height>
      <Depth>${data.dimensions.depth}</Depth>
    </Dimensions>
  </Environment>
  <ProposedItems>
    ${data.items.map(item => `
    <Item>
      <Description>${item.name}</Description>
      <Type>${item.type}</Type>
    </Item>`).join('')}
  </ProposedItems>
  <References>
    <ReferenceImage>${data.imageUrl}</ReferenceImage>
  </References>
</PromobProject>`;
}

export function downloadFile(content: string, fileName: string, contentType: string) {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}

export function generateDXF(width: number, depth: number): string {
  // Simple DXF with 4 lines forming the floor rectangle (dimensions in cm)
  const w = (width || 2) * 100;
  const d = (depth || 2) * 100;
  
  return `0
SECTION
2
ENTITIES
0
LINE
8
Walls
10
0.0
20
0.0
11
${w}
21
0.0
0
LINE
8
Walls
10
${w}
20
0.0
11
${w}
21
${d}
0
LINE
8
Walls
10
${w}
20
${d}
11
0.0
21
${d}
0
LINE
8
Walls
10
0.0
20
${d}
11
0.0
21
0.0
0
ENDSEC
0
EOF`;
}
