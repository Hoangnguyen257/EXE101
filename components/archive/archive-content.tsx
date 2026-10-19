'use client'

import { useState } from 'react'
import { ArchiveIcon, BoxIcon, FileTextIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/labels'
import type { ArchiveBox, Customer, DocumentFile, Shipment } from '@/lib/types'

interface ArchiveData {
  boxes: ArchiveBox[]
  documents: DocumentFile[]
  shipments: Shipment[]
  customers: Customer[]
}

export function ArchiveContent({ data }: { data: ArchiveData }) {
  const [search, setSearch] = useState('')

  const archivedDocs = data.documents.filter((d) => d.archiveBoxId)

  const filteredBoxes = data.boxes.filter(
    (b) =>
      b.code.toLowerCase().includes(search.toLowerCase()) ||
      b.warehouse.toLowerCase().includes(search.toLowerCase()) ||
      b.period.includes(search),
  )

  const filteredDocs = archivedDocs.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.fileName.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Tìm kiếm thùng, chứng từ..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Tabs defaultValue="boxes">
        <TabsList>
          <TabsTrigger value="boxes">
            <BoxIcon className="mr-1.5 size-4" />
            Thùng lưu trữ ({data.boxes.length})
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileTextIcon className="mr-1.5 size-4" />
            Chứng từ đã lưu ({archivedDocs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="boxes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Thùng lưu trữ</CardTitle>
              <CardDescription>Vị trí vật lý của từng thùng chứng từ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã thùng</TableHead>
                      <TableHead>Kho</TableHead>
                      <TableHead>Kệ / Ô</TableHead>
                      <TableHead>Kỳ</TableHead>
                      <TableHead>Số chứng từ</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBoxes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          Không tìm thấy thùng lưu trữ
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBoxes.map((box) => (
                        <TableRow key={box.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ArchiveIcon className="size-4 text-muted-foreground" />
                              <span className="font-mono text-sm font-medium">{box.code}</span>
                            </div>
                          </TableCell>
                          <TableCell>{box.warehouse}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {box.shelf} — {box.box}
                            </Badge>
                          </TableCell>
                          <TableCell>{box.period}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{box.documentIds.length} chứng từ</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(box.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Chứng từ đã lưu kho</CardTitle>
              <CardDescription>Bản cứng đã được lưu vào thùng lưu trữ vật lý</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chứng từ</TableHead>
                      <TableHead>Lô hàng</TableHead>
                      <TableHead>Thùng</TableHead>
                      <TableHead>Hạn lưu trữ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          Không tìm thấy chứng từ
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDocs.map((doc) => {
                        const shipment = data.shipments.find((s) => s.id === doc.shipmentId)
                        const box = data.boxes.find((b) => b.id === doc.archiveBoxId)
                        return (
                          <TableRow key={doc.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileTextIcon className="size-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{doc.title}</p>
                                  <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{shipment?.jobNo ?? '—'}</TableCell>
                            <TableCell>
                              {box ? (
                                <Badge variant="outline">{box.code}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(doc.retentionUntil)}</TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
